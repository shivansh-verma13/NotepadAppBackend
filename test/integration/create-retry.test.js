import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { readConfig } from '../../utils/config.js';
import { connectToDatabase, disconnectFromDatabase } from '../../db/connections.js';
import { UserModel } from '../../models/user.js';

const windowMs = 24 * 60 * 60 * 1000;
const key = (time = Date.now()) => `${time}.${randomUUID()}`;

test('real synthetic Mongo/HTTP: lost create response, concurrent retries, persistence, ownership and bounded receipts', {timeout:180000}, async t => {
  const mongo = await MongoMemoryServer.create({instance:{dbName:'notes_retry_synthetic'}});
  t.after(()=>mongo.stop());
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  const config = readConfig({...process.env,NODE_ENV:'test',MONGODB_URL:mongo.getUri(),COOKIE_SECRET:randomBytes(32).toString('hex'),FRONTEND_ORIGINS:'http://localhost:3000'});
  await connectToDatabase(config.mongoUrl);
  t.after(()=>disconnectFromDatabase());
  const server = createApp(config).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = cookie => ({Origin:'http://localhost:3000','X-Notes-Request':'1','Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})});
  const request = (path,method='GET',body,cookie) => fetch(`${base}/notepad${path}`,{method,headers:headers(cookie),...(body===undefined?{}:{body:JSON.stringify(body)})});
  const register = async username => {
    const response = await request('/user/register','POST',{name:'Synthetic',username,password:'synthetic test password'});
    assert.equal(response.status,201);
    return response.headers.get('set-cookie').split(';')[0];
  };
  const cookie = await register('retry-owner');
  const otherCookie = await register('retry-other');
  const owner = await UserModel.findOne({username:'retry-owner'});
  // Legacy documents do not have a receipt array; Mongo must initialize it safely.
  await UserModel.collection.updateOne({_id:owner._id},{$unset:{noteCreates:1}});
  const draft = {title:' Synthetic title ',content:'Synthetic body',createKey:key()};
  // Relay a real committed API request, then withhold its response until client timeout.
  let committedBeforeTimeout=false;
  const proxy = createServer(async req=>{
    let body=''; for await (const chunk of req) body+=chunk;
    const committed = await request('/notes/newNote','POST',JSON.parse(body),cookie);
    assert.equal(committed.status,201);
    await committed.json();
    committedBeforeTimeout=true;
  }).listen(0,'127.0.0.1');
  await new Promise(resolve=>proxy.once('listening',resolve));
  t.after(()=>new Promise(resolve=>proxy.close(resolve)));
  await assert.rejects(fetch(`http://127.0.0.1:${proxy.address().port}`,{method:'POST',headers:headers(cookie),body:JSON.stringify(draft),signal:AbortSignal.timeout(1000)}),error=>error.name==='TimeoutError');
  assert.equal(committedBeforeTimeout,true);
  assert.equal((await UserModel.findById(owner._id)).notes.length,1);
  await disconnectFromDatabase(); await connectToDatabase(config.mongoUrl);
  const retries = await Promise.all(Array.from({length:6},()=>request('/notes/newNote','POST',draft,cookie)));
  for (const response of retries) {
    assert.equal(response.status,201);
    const result=await response.json();
    assert.equal(result.notes.length,1);
    assert.equal(result.notes[0].title,'Synthetic title');
    assert.equal('noteCreates' in result,false);
  }
  let saved = await UserModel.findById(owner._id);
  assert.equal(saved.notes.length,1); assert.equal(saved.noteCreates.length,1);
  const receipt = saved.noteCreates[0].toObject();
  assert.equal(receipt.hash.length,64); assert.equal('content' in receipt,false);
  assert.equal((await request('/notes/newNote','POST',{...draft,content:'Different'},cookie)).status,409);
  assert.equal((await request('/notes/newNote','POST',draft,otherCookie)).status,201);
  assert.equal((await UserModel.findOne({username:'retry-other'})).notes.length,1);
  const noteID = saved.notes[0]._id.toString();
  assert.equal((await request('/notes/updateNote','PATCH',{noteID,content:'Edited'},cookie)).status,200);
  assert.equal((await (await request('/notes/newNote','POST',draft,cookie)).json()).notes[0].content,'Edited');
  assert.equal((await request(`/notes/deleteNote/${noteID}`,'DELETE',undefined,cookie)).status,200);
  assert.deepEqual((await (await request('/notes/newNote','POST',draft,cookie)).json()).notes,[]);
  // Never evict live receipts at capacity. Even a deleted note can still be replayed safely.
  const receipts = [receipt,...Array.from({length:999},()=>({...receipt,key:key()}))];
  await UserModel.updateOne({_id:owner._id},{$set:{noteCreates:receipts}});
  assert.equal((await request('/notes/newNote','POST',{...draft,createKey:key()},cookie)).status,429);
  assert.equal((await request('/notes/newNote','POST',draft,cookie)).status,201);
  assert.equal((await UserModel.findById(owner._id)).notes.length,0);
  // Pruning permits new work, but an old key remains invalid after its receipt is gone.
  receipts[1]={...receipt,key:key(Date.now()-windowMs-10000),issuedAt:Date.now()-windowMs-10000};
  const expiredKey=receipts[1].key;
  await UserModel.updateOne({_id:owner._id},{$set:{noteCreates:receipts}});
  const newDraft={...draft,createKey:key()};
  const capacityRace=await Promise.all([newDraft,{...draft,createKey:key()}].map(body=>request('/notes/newNote','POST',body,cookie)));
  assert.deepEqual(capacityRace.map(response=>response.status).sort(),[201,429]);
  assert.equal((await request('/notes/newNote','POST',{...draft,createKey:expiredKey},cookie)).status,400);
  saved=await UserModel.findById(owner._id);
  assert.equal(saved.noteCreates.length,1000); assert.equal(saved.notes.length,1);
  // Race first attempts, rather than only replays of an already-written receipt.
  const firstRace={...draft,createKey:key()};
  const raced=await Promise.all(Array.from({length:6},()=>request('/notes/newNote','POST',firstRace,otherCookie)));
  for(const response of raced) assert.equal(response.status,201);
  const other=await UserModel.findOne({username:'retry-other'});
  assert.equal(other.notes.length,2);assert.equal(other.noteCreates.length,2);
  // Replays succeed at the note cap; new distinct keys still respect the cap.
  await UserModel.updateOne({_id:owner._id},{$set:{notes:Array.from({length:200},()=>({title:'Cap fixture',content:'Synthetic'})),noteCreates:[receipt]}});
  assert.equal((await request('/notes/newNote','POST',draft,cookie)).status,201);
  assert.equal((await request('/notes/newNote','POST',{...draft,createKey:key()},cookie)).status,409);
  assert.equal((await UserModel.findById(owner._id)).notes.length,200);
});
