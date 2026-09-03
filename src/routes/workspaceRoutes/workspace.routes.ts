import { Router } from "express";
import {
  createWorkspace,
  inviteToWorkspace,
  joinWorkspace,
  getAllWorkspaces,
  updateWorkspace,
  deleteWorkspace,
} from "../../controllers/workspace.controllers.js";
import { requireAuth } from "../../middlewares/auth.middlewares.js";

const router = Router();

router.use(requireAuth); // every workspace route requires a logged-in user

router.post("/create-workspace", createWorkspace);
router.post("/invite-people", inviteToWorkspace);
router.post("/join-workspace", joinWorkspace);
router.get("/get-workspaces", getAllWorkspaces);
router.patch("/update-workspace", updateWorkspace);
router.delete("/delete-workspace", deleteWorkspace);

export default router;