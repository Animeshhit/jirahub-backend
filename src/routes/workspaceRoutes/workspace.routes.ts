import { Router } from "express";
import {
  createWorkspace,
  inviteToWorkspace,
  joinWorkspace,
  getAllWorkspaces,
  updateWorkspace,
  deleteWorkspace,
  getWorkspaceById,
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
router.get("/:workspaceId", getWorkspaceById);

export default router;