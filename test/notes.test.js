import test from 'node:test';
import assert from 'node:assert/strict';
import { createNoteControllers } from '../controllers/notes-service.js';
import { verifyToken, createToken } from '../utils/token-manager.js';
import { COOKIE_NAME } from '../utils/constants.js';
import { randomBytes } from 'node:crypto';

const owner = '111111111111111111111111';
const noteID = '222222222222222222222222';
function response(id = owner) {
  return { locals: { jwtData: { id } }, status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
}
test('invalid and oversized drafts never reach the database', async () => {
  const controller = createNoteControllers({ findOneAndUpdate() { throw new Error('must not run'); } });
  for (const body of [{ title:' ',content:'hello' },{ title:'title',content:'x'.repeat(20001) },{ title:{ $ne:null },content:'hello' }]) {
    const res = response(); await controller.createUserNote({body},res); assert.equal(res.code,400);
  }
});
test('create uses atomic push with an owner and database-enforced note cap', async () => {
  const controller = createNoteControllers({ async findOneAndUpdate(filter,update,options) {
    assert.equal(filter._id,owner); assert.equal(filter.$expr.$lt[1],200);
    assert.deepEqual(update,{$push:{notes:{title:'title',content:'content'}}});
    assert.equal(options.runValidators,true); assert.deepEqual(options.projection,{notes:1});
    return {notes:[{title:'title',content:'content'}]};
  } });
  const res = response(); await controller.createUserNote({body:{title:' title ',content:'content'}},res); assert.equal(res.code,201);
});
test('edit and delete cannot target a note without its authenticated owner', async () => {
  const seen=[];
  const controller=createNoteControllers({async findOneAndUpdate(filter,update) { seen.push({filter,update}); return null; }});
  const edit=response(); await controller.updateUserNote({body:{noteID,content:'updated'}},edit);
  const remove=response(); await controller.deleteNote({params:{noteID}},remove);
  assert.equal(edit.code,404); assert.equal(remove.code,404);
  for(const query of seen) assert.deepEqual(query.filter,{_id:owner,'notes._id':noteID});
  assert.deepEqual(seen[0].update,{$set:{'notes.$.content':'updated'}});
  assert.deepEqual(seen[1].update,{$pull:{notes:{_id:noteID}}});
});
test('unauthenticated and malformed IDs fail before database access', async () => {
  const controller=createNoteControllers({findOneAndUpdate(){throw Error('must not run');}});
  const unauth=response('invalid'); await controller.createUserNote({body:{}},unauth); assert.equal(unauth.code,401);
  const invalid=response(); await controller.deleteNote({params:{noteID:'invalid'}},invalid); assert.equal(invalid.code,400);
});
test('database errors do not expose internal messages', async () => {
  const controller=createNoteControllers({async findById(){throw Error('private connection details');}});
  const res=response(); await controller.getUserNotes({},res); assert.equal(res.code,500); assert.equal(JSON.stringify(res.data).includes('private'),false);
});
test('expired, tampered and invalid signed-cookie tokens return 401 without a rejected promise', () => {
  process.env.JWT_SECRET=randomBytes(32).toString('hex');
  for(const token of [false,'tampered',createToken('demo',owner,'-1s'),createToken('demo','invalid','1m')]) {
    const res=response(); let called=false;
    verifyToken({signedCookies:{[COOKIE_NAME]:token}},res,()=>{called=true;});
    assert.equal(res.code,401); assert.equal(called,false);
  }
  const res=response(); let called=false;
  verifyToken({signedCookies:{[COOKIE_NAME]:createToken('demo',owner,'1m')}},res,()=>{called=true;});
  assert.equal(called,true); assert.equal(res.locals.jwtData.id,owner);
});
