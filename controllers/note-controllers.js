import { UserModel } from "../models/user.js";
import { createNoteControllers } from "./notes-service.js";
export const { getUserNotes, createUserNote, deleteNote, updateUserNote } = createNoteControllers(UserModel);
