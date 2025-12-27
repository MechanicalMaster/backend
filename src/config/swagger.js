
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Swipe Backend API',
            version: '1.0.0',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Local Development Server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                InvoiceAggregate: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        invoiceNumber: { type: 'string' },
                        type: { type: 'string', enum: ['INVOICE', 'PROFORMA', 'LENDING'] },
                        status: { type: 'string', enum: ['PAID', 'PARTIAL', 'UNPAID', 'PENDING'] },
                        date: { type: 'string', format: 'date' },
                        dueDate: { type: 'string', format: 'date', nullable: true },
                        placeOfSupply: { type: 'string', nullable: true },
                        customer: {
                            type: 'object',
                            nullable: true,
                            properties: {
                                id: { type: 'string', format: 'uuid' },
                                name: { type: 'string' },
                                phone: { type: 'string', nullable: true },
                                gstin: { type: 'string', nullable: true },
                                address: { type: 'object', nullable: true },
                            },
                        },
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    productId: { type: 'string', format: 'uuid', nullable: true },
                                    description: { type: 'string', nullable: true },
                                    quantity: { type: 'number' },
                                    rate: { type: 'number' },
                                    taxRate: { type: 'number', nullable: true },
                                    weight: { type: 'object', nullable: true },
                                    amount: { type: 'object', nullable: true },
                                },
                            },
                        },
                        totals: {
                            type: 'object',
                            nullable: true,
                            properties: {
                                subtotal: { type: 'number' },
                                taxTotal: { type: 'number' },
                                cgst: { type: 'number' },
                                sgst: { type: 'number' },
                                igst: { type: 'number' },
                                roundOff: { type: 'number' },
                                grandTotal: { type: 'number' },
                            },
                        },
                        photos: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    url: { type: 'string' },
                                    createdAt: { type: 'string', format: 'date-time' },
                                },
                            },
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Customer: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        phone: { type: 'string', nullable: true },
                        gstin: { type: 'string', nullable: true },
                        email: { type: 'string', nullable: true },
                        address: {
                            oneOf: [
                                { type: 'object' },
                                { type: 'string' }
                            ],
                            nullable: true
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Vendor: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        phone: { type: 'string', nullable: true },
                        gstin: { type: 'string', nullable: true },
                        email: { type: 'string', nullable: true },
                        address: {
                            oneOf: [
                                { type: 'object' },
                                { type: 'string' }
                            ],
                            nullable: true
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Category: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        type: { type: 'string', enum: ['product', 'service'] },
                        subcategories: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    name: { type: 'string' },
                                    categoryId: { type: 'string', format: 'uuid' }
                                }
                            }
                        }
                    }
                },
                Product: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        type: { type: 'string', enum: ['product', 'service'] },
                        name: { type: 'string' },
                        sku: { type: 'string', nullable: true },
                        barcode: { type: 'string', nullable: true },
                        hsn: { type: 'string', nullable: true },
                        categoryId: { type: 'string', format: 'uuid', nullable: true },
                        subcategoryId: { type: 'string', format: 'uuid', nullable: true },
                        description: { type: 'string', nullable: true },
                        sellingPrice: { type: 'number' },
                        purchasePrice: { type: 'number' },
                        taxRate: { type: 'number' },
                        unit: { type: 'string', nullable: true },
                        metal: { type: 'object', nullable: true },
                        gemstone: { type: 'object', nullable: true },
                        design: { type: 'object', nullable: true },
                        images: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    url: { type: 'string' },
                                    createdAt: { type: 'string', format: 'date-time' }
                                }
                            }
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' }
                    }
                },
                Purchase: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        purchaseNumber: { type: 'string' },
                        vendorId: { type: 'string', format: 'uuid' },
                        status: { type: 'string', enum: ['RECEIVED', 'PENDING', 'ORDERED'] },
                        date: { type: 'string', format: 'date' },
                        dueDate: { type: 'string', format: 'date', nullable: true },
                        vendorInvoiceNumber: { type: 'string', nullable: true },
                        vendor: { $ref: '#/components/schemas/Vendor' },
                        items: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', format: 'uuid' },
                                    description: { type: 'string' },
                                    quantity: { type: 'number' },
                                    rate: { type: 'number' },
                                    taxRate: { type: 'number' },
                                    amount: { type: 'number' }
                                }
                            }
                        },
                        totals: {
                            type: 'object',
                            properties: {
                                subtotal: { type: 'number' },
                                taxTotal: { type: 'number' },
                                grandTotal: { type: 'number' }
                            }
                        }
                    }
                },
                Payment: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        receiptNumber: { type: 'string' },
                        type: { type: 'string', enum: ['IN', 'OUT'] },
                        partyType: { type: 'string', enum: ['CUSTOMER', 'VENDOR'] },
                        partyId: { type: 'string', format: 'uuid' },
                        amount: { type: 'number' },
                        date: { type: 'string', format: 'date' },
                        mode: { type: 'string' },
                        notes: { type: 'string', nullable: true },
                        allocations: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    invoiceId: { type: 'string', format: 'uuid' },
                                    amount: { type: 'number' }
                                }
                            }
                        },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                Attendance: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', format: 'uuid' },
                        userId: { type: 'string', format: 'uuid' },
                        loginTime: { type: 'string', format: 'date-time' },
                        logoutTime: { type: 'string', format: 'date-time', nullable: true },
                        duration: { type: 'number', nullable: true },
                        date: { type: 'string', format: 'date' }
                    }
                },
                Setting: {
                    type: 'object',
                    properties: {
                        key: { type: 'string' },
                        value: {
                            oneOf: [
                                { type: 'string' },
                                { type: 'number' },
                                { type: 'boolean' },
                                { type: 'object' }
                            ]
                        }
                    }
                }
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ['./src/routes/*.js'], // Path to the API docs
};

export const swaggerSpec = swaggerJsdoc(options);
