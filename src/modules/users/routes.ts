import { Router } from "express";
import {
  createUserBodySchema,
  listUsersQuerySchema,
  updateUserBodySchema,
  userDetailQuerySchema,
} from "./schemas.js";
import {
  createUser,
  deleteUser,
  getUserById,
  listUsers,
  mapUserToAdminRow,
  updateUser,
} from "./service.js";
import { getUserAdminDetail } from "./detail-service.js";
import { getUsersAnalyticsSummary } from "./analytics-service.js";

export const usersRouter = Router();

usersRouter.get("/analytics/summary", async (req, res, next) => {
  try {
    const monthsRaw = Number(req.query.months);
    const months = Number.isFinite(monthsRaw) ? monthsRaw : 12;
    const metric = req.query.metric === "sessions" ? "sessions" : "signups";
    const data = await getUsersAnalyticsSummary(months, metric);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
});

usersRouter.get("/", async (req, res, next) => {
  try {
    const q = listUsersQuerySchema.parse(req.query);
    const { rows, total } = await listUsers({
      skip: q.skip,
      take: q.take,
      search: q.search,
      language: q.language,
      level: q.level,
      accountStatus: q.accountStatus,
    });
    res.json({
      success: true,
      data: { users: rows, total, skip: q.skip, take: q.take },
    });
  } catch (e) {
    next(e);
  }
});

usersRouter.get("/:id/detail", async (req, res, next) => {
  try {
    const q = userDetailQuerySchema.parse(req.query);
    const detail = await getUserAdminDetail(req.params.id, q.language);
    if (!detail) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: detail });
  } catch (e) {
    next(e);
  }
});

usersRouter.get("/:id", async (req, res, next) => {
  try {
    const u = await getUserById(req.params.id);
    if (!u) {
      res.status(404).json({ success: false, error: "User not found" });
      return;
    }
    res.json({ success: true, data: mapUserToAdminRow(u) });
  } catch (e) {
    next(e);
  }
});

usersRouter.post("/", async (req, res, next) => {
  try {
    const body = createUserBodySchema.parse(req.body);
    const created = await createUser({
      email: body.email,
      uid: body.uid,
      displayName: body.displayName ?? undefined,
      photoURL: body.photoURL ?? undefined,
      level: body.level ?? undefined,
      learningLanguage: body.learningLanguage ?? undefined,
      learningLanguages: body.learningLanguages,
      nativeLanguage: body.nativeLanguage ?? undefined,
      expoPushToken: body.expoPushToken ?? undefined,
    });
    res.status(201).json({ success: true, data: mapUserToAdminRow(created) });
  } catch (e) {
    next(e);
  }
});

usersRouter.patch("/:id", async (req, res, next) => {
  try {
    const body = updateUserBodySchema.parse(req.body);
    const updated = await updateUser(req.params.id, {
      ...(body.email !== undefined && { email: body.email }),
      ...(body.uid !== undefined && { uid: body.uid }),
      ...(body.displayName !== undefined && { displayName: body.displayName }),
      ...(body.photoURL !== undefined && { photoURL: body.photoURL }),
      ...(body.level !== undefined && { level: body.level }),
      ...(body.learningLanguage !== undefined && {
        learningLanguage: body.learningLanguage,
      }),
      ...(body.learningLanguages !== undefined && {
        learningLanguages: body.learningLanguages,
      }),
      ...(body.nativeLanguage !== undefined && {
        nativeLanguage: body.nativeLanguage,
      }),
      ...(body.expoPushToken !== undefined && {
        expoPushToken: body.expoPushToken,
      }),
      ...(body.isSuspended !== undefined && { isSuspended: body.isSuspended }),
    });
    res.json({ success: true, data: mapUserToAdminRow(updated) });
  } catch (e) {
    next(e);
  }
});

usersRouter.delete("/:id", async (req, res, next) => {
  try {
    await deleteUser(req.params.id);
    res.json({ success: true, data: { deleted: true } });
  } catch (e) {
    next(e);
  }
});
