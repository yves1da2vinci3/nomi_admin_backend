import Joi from "joi";

export type IngestUsageBody = {
  /** Borne basse forcée — sert au rattrapage d'un historique. */
  since?: Date;
  /** Plafond de lignes lues par source. */
  limit?: number;
};

export const ingestUsageBodySchema = Joi.object<IngestUsageBody>({
  since: Joi.date().iso().max("now"),
  limit: Joi.number().integer().min(1).max(20000),
});
