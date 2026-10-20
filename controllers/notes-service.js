import { createHash } from "node:crypto";

const objectId = /^[a-f\d]{24}$/i;
const createKeyPattern = /^(\d{13})\.([a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12})$/i;
const retryWindow = 24 * 60 * 60 * 1000;
const validText = (v, limit) => typeof v === "string" && v.trim().length > 0 && v.length <= limit;
export function createNoteControllers(model, now = Date.now) {
  const action = operation => async (req, res) => {
    const owner = res.locals.jwtData?.id;
    if (typeof owner !== "string" || !objectId.test(owner)) return res.status(401).json({message:"Authentication required"});
    try { return await operation(req, res, owner); }
    catch { return res.status(500).json({message:"Unable to save notes. Please retry."}); }
  };
  const options = {new:true,runValidators:true,projection:{notes:1}};
  return {
    getUserNotes: action(async (_req,res,owner) => {
      const user = await model.findById(owner,{notes:1});
      return user ? res.status(200).json({message:"OK",userNotes:user.notes}) : res.status(401).json({message:"Authentication required"});
    }),
    createUserNote: action(async (req,res,owner) => {
      const {title,content,createKey} = req.body ?? {};
      if (!validText(title,120) || !validText(content,20000)) return res.status(400).json({message:"Enter a title (1–120 characters) and content (1–20,000 characters)."});
      const filter = {_id:owner,$expr:{$lt:[{$size:{$ifNull:["$notes",[]]}},200]}};
      const push = {notes:{title:title.trim(),content}};
      let receipt;
      if (createKey !== undefined) {
        const match = typeof createKey === "string" && createKeyPattern.exec(createKey);
        if (!match) return res.status(400).json({message:"Invalid create retry key."});
        const issuedAt = Number(match[1]);
        const time = now();
        if (issuedAt <= time - retryWindow || issuedAt > time + 60000) return res.status(400).json({code:"CREATE_RETRY_EXPIRED",message:"Create retry window expired or clock is incorrect. Check your library before starting a new note."});
        receipt = {key:createKey,issuedAt,hash:createHash("sha256").update(JSON.stringify([title.trim(),content])).digest("hex")};
        // Never evict an accepted, still-retryable key, including after note deletion.
        await model.updateOne({_id:owner},{$pull:{noteCreates:{issuedAt:{$lte:time-retryWindow}}}});
        filter["noteCreates.key"] = {$ne:createKey};
        filter.$expr = {$and:[filter.$expr,{$lt:[{$size:{$ifNull:["$noteCreates",[]]}},1000]}]};
        push.noteCreates = receipt;
      }
      const user = await model.findOneAndUpdate(filter,{$push:push},options);
      if (!user && receipt) {
        const current = await model.findById(owner,{notes:1,noteCreates:1});
        if (!current) return res.status(401).json({message:"Authentication required"});
        const previous = current.noteCreates?.find(item => item.key === createKey);
        if (previous) return previous.hash === receipt.hash
          ? res.status(201).json({message:"Created a Note",notes:current.notes})
          : res.status(409).json({message:"This create retry key was already used for a different draft."});
        if (current.noteCreates?.length >= 1000) return res.status(429).json({message:"Create retry capacity reached. Wait for older requests to expire before adding another note."});
      }
      return user ? res.status(201).json({message:"Created a Note",notes:user.notes}) : res.status(409).json({message:"Unable to add a note. Your account may have reached the 200-note limit."});
    }),
    updateUserNote: action(async (req,res,owner) => {
      const {noteID,content} = req.body ?? {};
      if (typeof noteID !== "string" || !objectId.test(noteID) || !validText(content,20000)) return res.status(400).json({message:"Provide a valid note and content (1–20,000 characters)."});
      const user = await model.findOneAndUpdate({_id:owner,"notes._id":noteID},{$set:{"notes.$.content":content}},options);
      return user ? res.status(200).json({message:"OK",notes:user.notes}) : res.status(404).json({message:"Note not found"});
    }),
    deleteNote: action(async (req,res,owner) => {
      const noteID = req.params.noteID;
      if (typeof noteID !== "string" || !objectId.test(noteID)) return res.status(400).json({message:"Provide a valid note"});
      const user = await model.findOneAndUpdate({_id:owner,"notes._id":noteID},{$pull:{notes:{_id:noteID}}},options);
      return user ? res.status(200).json({message:"OK",userNotes:user.notes}) : res.status(404).json({message:"Note not found"});
    }),
  };
}
