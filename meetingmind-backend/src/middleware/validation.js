import Joi from 'joi';

export const fileUploadSchema = Joi.object({
    fileName: Joi.string().max(255).required(),
    fileType: Joi.string().valid('txt', 'pdf').required(),
    fileSize: Joi.number().max(50 * 1024 * 1024).required(),
});

export const taskCreationSchema = Joi.object({
    task: Joi.string().max(500).required(),
    owner: Joi.string().max(100).allow(null, ''),
    deadline: Joi.date().iso().allow(null),
    priority: Joi.string().valid('HIGH', 'MEDIUM', 'LOW').required(),
    confidence: Joi.number().min(0).max(1),
});

export const validateInput = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        return res.status(400).json({
            error: 'Validation failed',
            details: error.details.map((d) => d.message),
        });
    }

    req.validated = value;
    next();
};