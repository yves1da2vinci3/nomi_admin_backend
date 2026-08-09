import Joi from "joi";

export type PartnerLoginBody = {
  email: string;
  password: string;
};

export const partnerLoginBodySchema = Joi.object<PartnerLoginBody>({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(1).required(),
});
