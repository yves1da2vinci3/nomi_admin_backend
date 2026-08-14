import Joi from "joi";

export type PartnerLoginBody = {
  email: string;
  password: string;
};

export const partnerLoginBodySchema = Joi.object<PartnerLoginBody>({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(1).required(),
});

export type PartnerPatchMeBody = {
  displayName?: string;
  currentPassword?: string;
  newPassword?: string;
};

export const partnerPatchMeBodySchema = Joi.object<PartnerPatchMeBody>({
  displayName: Joi.string().trim().min(1).max(80),
  currentPassword: Joi.string().min(1),
  newPassword: Joi.string().min(8).max(200),
})
  .or("displayName", "newPassword")
  .and("currentPassword", "newPassword");
