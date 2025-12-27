import Joi from 'joi';

/**
 * Validation middleware factory
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {String} source - Request property to validate ('body', 'query', 'params')
 */
export function validate(schema, source = 'body') {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            error.isJoi = true;
            return next(error);
        }

        // Replace request data with validated data
        req[source] = value;
        next();
    };
}

// Common validation schemas
export const schemas = {
    uuid: Joi.string().uuid(),

    customer: Joi.object({
        name: Joi.string().required(),
        gstin: Joi.string().allow(null, ''),
        phone: Joi.string().allow(null, ''),
        email: Joi.string().email().allow(null, ''),
        address: Joi.alternatives().try(Joi.object(), Joi.string()).allow(null, '')
    }),

    vendor: Joi.object({
        name: Joi.string().required(),
        gstin: Joi.string().allow(null, ''),
        phone: Joi.string().allow(null, ''),
        email: Joi.string().email().allow(null, ''),
        address: Joi.alternatives().try(Joi.object(), Joi.string()).allow(null, '')
    }),

    product: Joi.object({
        type: Joi.string().valid('product', 'service').required(),
        name: Joi.string().required(),
        sku: Joi.string().allow(null, ''),
        barcode: Joi.string().allow(null, ''),
        hsn: Joi.string().allow(null, ''),
        categoryId: Joi.string().uuid().allow(null),
        subcategoryId: Joi.string().uuid().allow(null),
        description: Joi.string().allow(null, ''),
        sellingPrice: Joi.number().min(0).allow(null),
        purchasePrice: Joi.number().min(0).allow(null),
        taxRate: Joi.number().min(0).max(100).allow(null),
        unit: Joi.string().allow(null, ''),
        metal: Joi.object().allow(null),
        gemstone: Joi.object().allow(null),
        design: Joi.object().allow(null),
        vendorRef: Joi.string().allow(null, ''),
        procurementDate: Joi.string().isoDate().allow(null),
        hallmarkCert: Joi.string().allow(null, ''),
        launchDate: Joi.string().isoDate().allow(null),
        showOnline: Joi.boolean().default(false),
        notForSale: Joi.boolean().default(false)
    }),

    invoiceItem: Joi.object({
        productId: Joi.string().uuid().allow(null),
        description: Joi.string().allow(null, ''),
        quantity: Joi.number().required(),
        rate: Joi.number().required(),
        taxRate: Joi.number().min(0).max(100).allow(null),
        weight: Joi.object().allow(null),
        amount: Joi.object().allow(null)
    }),

    invoice: Joi.object({
        customerId: Joi.string().uuid().allow(null),
        type: Joi.string().valid('INVOICE', 'PROFORMA', 'LENDING').required(),
        status: Joi.string().valid('PAID', 'PARTIAL', 'UNPAID', 'PENDING').default('UNPAID'),
        date: Joi.string().isoDate().required(),
        dueDate: Joi.string().isoDate().allow(null),
        placeOfSupply: Joi.string().allow(null, ''),
        customer: Joi.object({
            name: Joi.string().required(),
            phone: Joi.string().allow(null, ''),
            gstin: Joi.string().allow(null, ''),
            address: Joi.alternatives().try(Joi.object(), Joi.string()).allow(null, '')
        }).required(),
        items: Joi.array().items(Joi.link('#invoiceItem')).min(1).required()
    }).id('invoice').shared(Joi.object().id('invoiceItem')),

    payment: Joi.object({
        type: Joi.string().valid('IN', 'OUT').required(),
        partyType: Joi.string().valid('CUSTOMER', 'VENDOR').required(),
        partyId: Joi.string().uuid().required(),
        amount: Joi.number().min(0).required(),
        date: Joi.string().isoDate().required(),
        mode: Joi.string().allow(null, ''),
        notes: Joi.string().allow(null, ''),
        allocations: Joi.array().items(
            Joi.object({
                invoiceId: Joi.string().uuid().required(),
                amount: Joi.number().min(0).required()
            })
        ).default([])
    })
};
