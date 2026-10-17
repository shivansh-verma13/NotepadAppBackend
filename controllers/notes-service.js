const objectId = /^[a-f\d]{24}$/i;
const validText = (v, limit) => typeof v === "string" && v.trim().length > 0 && v.length <= limit;
export function createNoteControllers(model) {
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
      const {title,content} = req.body ?? {};
      if (!validText(title,120) || !validText(content,20000)) return res.status(400).json({message:"Enter a title (1–120 characters) and content (1–20,000 characters)."});
      const user = await model.findOneAndUpdate({_id:owner,$expr:{$lt:[{$size:{$ifNull:["$notes",[]]}},200]}},{$push:{notes:{title:title.trim(),content}}},options);
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
