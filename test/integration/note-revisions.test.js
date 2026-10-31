import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../app.js';
import { readConfig } from '../../utils/config.js';
import { connectToDatabase, disconnectFromDatabase } from '../../db/connections.js';
import { UserModel } from '../../models/user.js';


test('real synthetic Mongo/HTTP: conditional revision concurrency, legacy notes, reconnect and ownership', {timeout:180000}, async t => {
  const mongo = await MongoMemoryServer.create({instance:{dbName:'notes_revisions_synthetic'}});
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
  const create=await request('/notes/newNote','POST',{title:'Revision fixture',content:'Original'},cookie);
  assert.equal(create.status,201);
  const note=(await create.json()).notes[0];
  assert.equal(note.revision,0);
  const noteID=note._id;
  const edit=(content,expectedRevision,cookieValue=cookie)=>request('/notes/updateNote','PATCH',{noteID,content,expectedRevision},cookieValue);
  const remove=(expectedRevision,cookieValue=cookie)=>request(`/notes/deleteNote/${noteID}`,'DELETE',{expectedRevision},cookieValue);
  // Exactly one competing edit can win with the same observed revision.
  const results=await Promise.all(['First','Second'].map(content=>edit(content,0)));
  assert.deepEqual(results.map(result=>result.status).sort(),[200,409]);
  const conflict=await results.find(result=>result.status===409).json();
  assert.equal(conflict.code,'NOTE_CONFLICT');assert.equal('notes' in conflict,false);
  const winner=(await (await request('/notes/all-notes','GET',undefined,cookie)).json()).userNotes[0];
  assert.equal(winner.revision,1);assert.ok(['First','Second'].includes(winner.content));
  assert.equal((await remove(0)).status,409);
  assert.equal((await edit('Foreign',1,otherCookie)).status,404);
  assert.equal((await remove(1,otherCookie)).status,404);
  assert.equal((await UserModel.findById(owner._id)).notes[0].content,winner.content);
  await disconnectFromDatabase();await connectToDatabase(config.mongoUrl);
  assert.equal((await edit('After reconnect',1)).status,200);
  assert.equal((await edit('Stale retry',1)).status,409);
  // Same revision edit/delete race: no stale overwrite; delete may see a missing note.
  const race=await Promise.all([edit('Race winner',2),remove(2)]);
  assert.equal(race.filter(result=>result.status===200).length,1);
  assert.ok([404,409].includes(race.find(result=>result.status!==200).status));
  let saved=await UserModel.findById(owner._id);
  if(saved.notes.length) {
    assert.equal(saved.notes[0].content,'Race winner');assert.equal(saved.notes[0].revision,3);
    assert.equal((await remove(3)).status,200);
  }
  assert.equal((await edit('Deleted',3)).status,404);
  assert.equal((await remove(3)).status,404);
  // Raw insert deliberately avoids schema defaults: existing records need no migration.
  const legacyID=new UserModel({notes:[{title:'Legacy',content:'Keep'}]}).notes[0]._id;
  await UserModel.collection.updateOne({_id:owner._id},{$push:{notes:{_id:legacyID,title:'Legacy',content:'Keep'}}});
  const legacy=(await (await request('/notes/all-notes','GET',undefined,cookie)).json()).userNotes[0];
  assert.equal(legacy.revision,0);
  assert.equal(Object.hasOwn((await UserModel.collection.findOne({_id:owner._id})).notes[0],'revision'),false);
  const legacyEdit=await request('/notes/updateNote','PATCH',{noteID:legacyID.toString(),content:'Migrates on write',expectedRevision:0},cookie);
  assert.equal(legacyEdit.status,200);assert.equal((await legacyEdit.json()).notes[0].revision,1);
  // Compatibility: legacy unconditional edits still advance revisions for conditional clients.
  const unconditional=await request('/notes/updateNote','PATCH',{noteID:legacyID.toString(),content:'Old client'},cookie);
  assert.equal(unconditional.status,200);assert.equal((await unconditional.json()).notes[0].revision,2);
  assert.equal((await request('/notes/updateNote','PATCH',{noteID:legacyID.toString(),content:'Stale',expectedRevision:1},cookie)).status,409);
  for(const expectedRevision of [null,-1,1.2,'2',{},Number.MAX_SAFE_INTEGER]) {
    assert.equal((await request('/notes/updateNote','PATCH',{noteID:legacyID.toString(),content:'Invalid',expectedRevision},cookie)).status,400);
    assert.equal((await request(`/notes/deleteNote/${legacyID}`,'DELETE',{expectedRevision},cookie)).status,400);
  }
  // A different note at revision two must not satisfy a legacy note's expected revision.
  await UserModel.collection.updateOne({_id:owner._id},{$push:{notes:{title:'Other',content:'Other',revision:8}}});
  assert.equal((await request('/notes/updateNote','PATCH',{noteID:legacyID.toString(),content:'Wrong element',expectedRevision:8},cookie)).status,409);
  assert.equal((await request(`/notes/deleteNote/${legacyID}`,'DELETE',{expectedRevision:2},cookie)).status,200);
  saved=await UserModel.findById(owner._id);
  assert.equal(saved.notes.length,1);assert.equal(saved.notes[0].title,'Other');assert.equal(saved.notes[0].revision,8);
});
