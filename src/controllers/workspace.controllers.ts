import { type Request, type Response } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db } from "../db/db.ts";
import { workspace, workspaceMembers, invites, users } from "../db/schema.ts";









export const getWorkspaceById = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    const userId = (req as any).user?.userId;

    if (!workspaceId || typeof workspaceId !== "string") {
      return res.status(400).json({ message: "workspaceId is required" });
    }

    const ws = await db.query.workspace.findFirst({
      where: eq(workspace.id, workspaceId),
    });

    if (!ws) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      ),
    });

    if (!membership) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    const memberRows = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, workspaceId),
      with: { user: { columns: { id: true, name: true, email: true } } },
    });

    const members = memberRows.map((row) => ({
      id: row.user.id,
      name: row.user.name,
      email: row.user.email,
      isAdmin: row.user.id === ws.createdBy,
      joinedOn: row.joinedOn,
    }));

    return res.status(200).json({ workspace: ws, members });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* ------------------------- CREATE WORKSPACE ------------------------- */

export const createWorkspace = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;
    const userId = (req as any).user?.userId;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Workspace name is required" });
    }

    const newWorkspace = await db.transaction(async (tx) => {
      const [ws] = await tx
        .insert(workspace)
        .values({ name: name.trim(), createdBy: userId })
        .returning();

     if(!ws) return res.status(500).json({ message: "Failed to create workspace" });
      // creator is automatically a member of their own workspace
      await tx.insert(workspaceMembers).values({
        workspaceId: ws.id,
        userId,
      });

      return ws;
    });

    return res.status(201).json({
      message: "Workspace created successfully",
      workspace: newWorkspace,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* --------------------------- INVITE PEOPLE --------------------------- */

export const inviteToWorkspace = async (req: Request, res: Response) => {
  try {
    const { workspaceId, email } = req.body;
    const userId = (req as any).user?.userId;

    if (!workspaceId || !email) {
      return res.status(400).json({ message: "workspaceId and email are required" });
    }

    // requester must be a member of the workspace to invite others
    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      ),
    });

    if (!membership) {
      return res.status(403).json({ message: "You are not a member of this workspace" });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!targetUser) {
      return res.status(404).json({ message: "No user found with that email" });
    }

    const alreadyMember = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, targetUser.id)
      ),
    });

    if (alreadyMember) {
      return res.status(409).json({ message: "User is already a member of this workspace" });
    }

    const existingInvite = await db.query.invites.findFirst({
      where: and(
        eq(invites.inviteForWorkspace, workspaceId),
        eq(invites.inviteTo, targetUser.id),
        eq(invites.inviteAccepted, false)
      ),
    });

    if (existingInvite) {
      return res.status(409).json({ message: "An invite is already pending for this user" });
    }

    const [invite] = await db
      .insert(invites)
      .values({
        inviteFrom: userId,
        inviteForWorkspace: workspaceId,
        inviteTo: targetUser.id,
      })
      .returning();

    return res.status(201).json({ message: "Invite sent successfully", invite });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* --------------------------- JOIN WORKSPACE --------------------------- */

export const joinWorkspace = async (req: Request, res: Response) => {
  try {
    const { inviteId } = req.body;
    const userId = (req as any).user?.userId;

    if (!inviteId) {
      return res.status(400).json({ message: "inviteId is required" });
    }

    const invite = await db.query.invites.findFirst({
      where: eq(invites.id, inviteId),
    });

    if (!invite) {
      return res.status(404).json({ message: "Invite not found" });
    }

    if (invite.inviteTo !== userId) {
      return res.status(403).json({ message: "This invite does not belong to you" });
    }

    if (invite.inviteAccepted) {
      return res.status(409).json({ message: "Invite has already been used" });
    }

    const joinedWorkspace = await db.transaction(async (tx) => {
      await tx.insert(workspaceMembers).values({
        workspaceId: invite.inviteForWorkspace,
        userId,
      });

      await tx
        .update(invites)
        .set({ inviteAccepted: true })
        .where(eq(invites.id, inviteId));

      return tx.query.workspace.findFirst({
        where: eq(workspace.id, invite.inviteForWorkspace),
      });
    });

    return res.status(200).json({
      message: "Joined workspace successfully",
      workspace: joinedWorkspace,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* -------------------------- GET ALL WORKSPACES -------------------------- */

export const getAllWorkspaces = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;

    const memberships = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.userId, userId),
      with: { workspace: true },
    });

    const workspaces = memberships.map((m) => m.workspace);

    return res.status(200).json({ workspaces });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "internal server error",
    });
  }
};

/* ------------------- UPDATE WORKSPACE (remove people) ------------------- */

export const updateWorkspace = async (req: Request, res: Response) => {
  try {
    const { workspaceId, removeUserId } = req.body;
    const userId = (req as any).user?.userId;

    if (!workspaceId || !removeUserId) {
      return res.status(400).json({ message: "workspaceId and removeUserId are required" });
    }

    const ws = await db.query.workspace.findFirst({
      where: eq(workspace.id, workspaceId),
    });

    if (!ws) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (ws.createdBy !== userId) {
      return res.status(403).json({ message: "Only the workspace admin can remove members" });
    }

    if (removeUserId === ws.createdBy) {
      return res.status(400).json({ message: "The workspace admin cannot be removed" });
    }

    const deleted = await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, removeUserId)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ message: "That user is not a member of this workspace" });
    }

    return res.status(200).json({ message: "Member removed successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/* --------------------------- DELETE WORKSPACE --------------------------- */

export const deleteWorkspace = async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.body;
    const userId = (req as any).user?.userId;

    if (!workspaceId) {
      return res.status(400).json({ message: "workspaceId is required" });
    }

    const ws = await db.query.workspace.findFirst({
      where: eq(workspace.id, workspaceId),
    });

    if (!ws) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    if (ws.createdBy !== userId) {
      return res.status(403).json({ message: "Only the workspace admin can delete this workspace" });
    }

    // boards, tasks, workspaceMembers, and invites all cascade-delete
    // via the onDelete: "cascade" foreign keys defined in schema.ts
    await db.delete(workspace).where(eq(workspace.id, workspaceId));

    return res.status(200).json({ message: "Workspace deleted successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

