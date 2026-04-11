const swaggerDefinition = {
  openapi: '3.0.3',
  info: {
    title: 'SchoolApp API',
    version: '1.0.0',
    description:
      'REST API for the School Event & Appointment Booking Platform.\n\n' +
      '**Auth:** Most endpoints require a Keycloak Bearer token. ' +
      'Parent endpoints use a short-lived JWT issued after OTP verification.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local dev' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Keycloak access token',
      },
      parentToken: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Short-lived JWT issued by POST /api/otp/verify',
      },
    },
    schemas: {
      School: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          address: { type: 'string', nullable: true },
          contactEmail: { type: 'string', format: 'email' },
          subscriptionPlan: { type: 'string', example: 'FREE' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SchoolInput: {
        type: 'object',
        required: ['name', 'contactEmail'],
        properties: {
          name: { type: 'string' },
          address: { type: 'string' },
          contactEmail: { type: 'string', format: 'email' },
          subscriptionPlan: { type: 'string', example: 'FREE' },
        },
      },
      Teacher: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          schoolId: { type: 'string' },
          keycloakUserId: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          subject: { type: 'string', nullable: true },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      TeacherInput: {
        type: 'object',
        required: ['name', 'email', 'keycloakUserId'],
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          keycloakUserId: { type: 'string' },
          subject: { type: 'string' },
        },
      },
      Event: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          schoolId: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string', nullable: true },
          eventType: { type: 'string', example: 'PARENT_TEACHER' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          location: { type: 'string', nullable: true },
          maxCapacity: { type: 'integer', nullable: true },
          qrCodeUrl: { type: 'string', nullable: true },
          qrToken: { type: 'string' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      EventInput: {
        type: 'object',
        required: ['title', 'eventType', 'startDate', 'endDate'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          eventType: { type: 'string', example: 'PARENT_TEACHER' },
          startDate: { type: 'string', format: 'date-time' },
          endDate: { type: 'string', format: 'date-time' },
          location: { type: 'string' },
          maxCapacity: { type: 'integer' },
        },
      },
      Slot: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          eventId: { type: 'string' },
          teacherId: { type: 'string', nullable: true },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          maxBookings: { type: 'integer' },
          currentBookings: { type: 'integer' },
          isActive: { type: 'boolean' },
        },
      },
      SlotInput: {
        type: 'object',
        required: ['startTime', 'endTime'],
        properties: {
          teacherId: { type: 'string' },
          startTime: { type: 'string', format: 'date-time' },
          endTime: { type: 'string', format: 'date-time' },
          maxBookings: { type: 'integer', default: 1 },
        },
      },
      Booking: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          eventId: { type: 'string' },
          slotId: { type: 'string', nullable: true },
          parentEmail: { type: 'string', format: 'email' },
          childName: { type: 'string', nullable: true },
          status: { type: 'string', example: 'CONFIRMED' },
          cancelToken: { type: 'string' },
          bookedAt: { type: 'string', format: 'date-time' },
        },
      },
      BookingInput: {
        type: 'object',
        required: ['eventId', 'slotId'],
        properties: {
          eventId: { type: 'string' },
          slotId: { type: 'string' },
          childName: { type: 'string' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
        },
      },
    },
  },
  paths: {
    // ── Health ──────────────────────────────────────────────────────────────
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string', example: 'ok' } } } } } } },
      },
    },

    // ── OTP ─────────────────────────────────────────────────────────────────
    '/api/otp/send': {
      post: {
        tags: ['OTP'],
        summary: 'Send OTP to parent email',
        description: 'Public — no auth. Sends a one-time code to the parent\'s email.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email'], properties: { email: { type: 'string', format: 'email' } } } } },
        },
        responses: {
          200: { description: 'OTP sent' },
          400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
        },
      },
    },
    '/api/otp/verify': {
      post: {
        tags: ['OTP'],
        summary: 'Verify OTP and receive parent JWT',
        description: 'Public — no auth. Returns a short-lived JWT used for booking.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['email', 'code'], properties: { email: { type: 'string', format: 'email' }, code: { type: 'string', example: '123456' } } } } },
        },
        responses: {
          200: { description: 'JWT token', content: { 'application/json': { schema: { type: 'object', properties: { token: { type: 'string' } } } } } },
          401: { description: 'Invalid or expired OTP' },
        },
      },
    },

    // ── Public (QR) ─────────────────────────────────────────────────────────
    '/api/public/events/by-qr/{qrToken}': {
      get: {
        tags: ['Public'],
        summary: 'Get event by QR token',
        description: 'No auth — accessed by parents after scanning a QR code.',
        parameters: [{ name: 'qrToken', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Event data', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } },
          404: { description: 'Not found' },
        },
      },
    },
    '/api/public/events/by-qr/{qrToken}/slots': {
      get: {
        tags: ['Public'],
        summary: 'Get available slots for a QR event',
        parameters: [{ name: 'qrToken', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'List of slots', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Slot' } } } } },
        },
      },
    },

    // ── Schools ─────────────────────────────────────────────────────────────
    '/api/schools': {
      get: {
        tags: ['Schools'],
        summary: 'List schools',
        description: 'PLATFORM_ADMIN sees all; SCHOOL_ADMIN sees only their own.',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Array of schools', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/School' } } } } } },
      },
      post: {
        tags: ['Schools'],
        summary: 'Create a school',
        description: 'PLATFORM_ADMIN only.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SchoolInput' } } } },
        responses: {
          201: { description: 'Created school', content: { 'application/json': { schema: { $ref: '#/components/schemas/School' } } } },
          403: { description: 'Forbidden' },
        },
      },
    },
    '/api/schools/{id}': {
      get: {
        tags: ['Schools'],
        summary: 'Get school by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'School', content: { 'application/json': { schema: { $ref: '#/components/schemas/School' } } } }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Schools'],
        summary: 'Update a school',
        description: 'PLATFORM_ADMIN only.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SchoolInput' } } } },
        responses: { 200: { description: 'Updated school', content: { 'application/json': { schema: { $ref: '#/components/schemas/School' } } } } },
      },
      delete: {
        tags: ['Schools'],
        summary: 'Delete a school',
        description: 'PLATFORM_ADMIN only.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' }, 403: { description: 'Forbidden' } },
      },
    },

    // ── Teachers ────────────────────────────────────────────────────────────
    '/api/teachers': {
      get: {
        tags: ['Teachers'],
        summary: 'List teachers',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'schoolId', in: 'query', schema: { type: 'string' }, description: 'Filter by school' }],
        responses: { 200: { description: 'Array of teachers', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Teacher' } } } } } },
      },
      post: {
        tags: ['Teachers'],
        summary: 'Create a teacher',
        description: 'SCHOOL_ADMIN only.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TeacherInput' } } } },
        responses: { 201: { description: 'Created teacher', content: { 'application/json': { schema: { $ref: '#/components/schemas/Teacher' } } } } },
      },
    },
    '/api/teachers/{id}': {
      get: {
        tags: ['Teachers'],
        summary: 'Get teacher by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Teacher', content: { 'application/json': { schema: { $ref: '#/components/schemas/Teacher' } } } }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Teachers'],
        summary: 'Update a teacher',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TeacherInput' } } } },
        responses: { 200: { description: 'Updated teacher', content: { 'application/json': { schema: { $ref: '#/components/schemas/Teacher' } } } } },
      },
      delete: {
        tags: ['Teachers'],
        summary: 'Delete a teacher',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' } },
      },
    },

    // ── Events ──────────────────────────────────────────────────────────────
    '/api/events': {
      get: {
        tags: ['Events'],
        summary: 'List events',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'schoolId', in: 'query', schema: { type: 'string' }, description: 'Filter by school' }],
        responses: { 200: { description: 'Array of events', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Event' } } } } } },
      },
      post: {
        tags: ['Events'],
        summary: 'Create an event',
        description: 'SCHOOL_ADMIN only.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EventInput' } } } },
        responses: { 201: { description: 'Created event', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } } },
      },
    },
    '/api/events/{id}': {
      get: {
        tags: ['Events'],
        summary: 'Get event by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Event', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } }, 404: { description: 'Not found' } },
      },
      patch: {
        tags: ['Events'],
        summary: 'Update an event',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/EventInput' } } } },
        responses: { 200: { description: 'Updated event', content: { 'application/json': { schema: { $ref: '#/components/schemas/Event' } } } } },
      },
      delete: {
        tags: ['Events'],
        summary: 'Delete an event',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' } },
      },
    },
    '/api/events/{id}/qr': {
      get: {
        tags: ['Events'],
        summary: 'Get QR code for an event',
        description: 'SCHOOL_ADMIN only. Returns a QR code image pointing to the public booking page.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'QR code PNG image', content: { 'image/png': {} } } },
      },
    },

    // ── Slots ───────────────────────────────────────────────────────────────
    '/api/events/{eventId}/slots': {
      get: {
        tags: ['Slots'],
        summary: 'List slots for an event',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'teacherId', in: 'query', schema: { type: 'string' }, description: 'Filter by teacher' },
        ],
        responses: { 200: { description: 'Array of slots', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Slot' } } } } } },
      },
      post: {
        tags: ['Slots'],
        summary: 'Create slots for an event',
        description: 'SCHOOL_ADMIN only. Accepts an array of slot objects.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'eventId', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/SlotInput' } } } } },
        responses: { 201: { description: 'Created slots', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Slot' } } } } } },
      },
    },
    '/api/slots/{id}': {
      patch: {
        tags: ['Slots'],
        summary: 'Update a slot',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SlotInput' } } } },
        responses: { 200: { description: 'Updated slot', content: { 'application/json': { schema: { $ref: '#/components/schemas/Slot' } } } } },
      },
      delete: {
        tags: ['Slots'],
        summary: 'Delete a slot',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 204: { description: 'Deleted' } },
      },
    },

    // ── Bookings ─────────────────────────────────────────────────────────────
    '/api/bookings': {
      get: {
        tags: ['Bookings'],
        summary: 'List bookings',
        description: 'SCHOOL_ADMIN or TEACHER. Filter by ?eventId= to scope to an event.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'eventId', in: 'query', schema: { type: 'string' }, description: 'Filter by event' }],
        responses: { 200: { description: 'Array of bookings', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Booking' } } } } } },
      },
      post: {
        tags: ['Bookings'],
        summary: 'Create a booking (parent)',
        description: 'Requires the short-lived parent JWT from POST /api/otp/verify.',
        security: [{ parentToken: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/BookingInput' } } } },
        responses: {
          201: { description: 'Booking confirmed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } },
          409: { description: 'Slot fully booked' },
        },
      },
    },
    '/api/bookings/{cancelToken}': {
      get: {
        tags: ['Bookings'],
        summary: 'Get booking by cancel token',
        description: 'Public — no auth. Used by parents to view their booking from the cancellation email link.',
        parameters: [{ name: 'cancelToken', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Booking', content: { 'application/json': { schema: { $ref: '#/components/schemas/Booking' } } } }, 404: { description: 'Not found' } },
      },
      delete: {
        tags: ['Bookings'],
        summary: 'Cancel a booking',
        description: 'Public — no auth. Parent cancels via the token in their confirmation email.',
        parameters: [{ name: 'cancelToken', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'Booking cancelled' }, 404: { description: 'Not found' } },
      },
    },
  },
};

export default swaggerDefinition;
