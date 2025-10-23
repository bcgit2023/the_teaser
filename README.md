# FutureLearner - AI-Powered English Learning Platform

An interactive English learning platform that combines AI tutoring, smart question generation, and comprehensive quiz assessment to provide personalized learning experiences.

## Features

- **AI Tutor Chat**: Interactive conversations with AI-powered tutors
- **Smart Questions**: Adaptive question generation based on user performance
- **Quiz Assessment**: Comprehensive quiz system with detailed analytics
- **Admin Dashboard**: Complete administrative interface for user and quiz management
- **Voice Integration**: Text-to-speech and speech recognition capabilities
- **Real-time Analytics**: Track learning progress and performance metrics

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT-based authentication with role-based access control
- **AI Services**: OpenAI GPT, Google AI, Groq, ElevenLabs TTS
- **Speech**: Deepgram for speech recognition

## Prerequisites

- Node.js 20.x or higher
- npm, yarn, or pnpm
- Supabase account and project

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd the_teaser
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your API keys and configuration in the `.env` file:
   - Supabase credentials
   - OpenAI API key
   - ElevenLabs API key
   - Google AI API key
   - Groq API key
   - Deepgram API key

4. **Database Setup**
   - Create a Supabase project
   - Run the migrations in the `supabase/migrations` folder
   - Update the Supabase configuration in your `.env` file

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── admin-dashboard/   # Admin interface
│   ├── chat/             # AI tutor chat
│   ├── quiz/             # Quiz interface
│   └── tutorial/         # Learning tutorials
├── components/            # Reusable React components
├── lib/                  # Utility libraries and services
│   ├── database/         # Database adapters
│   ├── services/         # Business logic services
│   └── middleware/       # Authentication middleware
├── public/               # Static assets
├── scripts/              # Database and utility scripts
├── supabase/             # Database migrations
└── types/                # TypeScript type definitions
```

## Key Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (Admin, Student, Parent)
- Secure session management
- Password reset functionality

### AI Integration
- Multiple AI providers for redundancy
- Smart question generation based on user performance
- Conversational AI tutoring
- Text-to-speech for accessibility

### Quiz System
- Adaptive question selection
- Real-time progress tracking
- Detailed performance analytics
- Question history and review

### Admin Dashboard
- User management
- Quiz analytics
- Performance monitoring
- System administration

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### Questions & Quizzes
- `GET /api/questions` - Get questions
- `GET /api/smart-questions` - Get adaptive questions
- `POST /api/quiz-results` - Submit quiz results

### Admin
- `GET /api/admin/users` - Get all users
- `GET /api/admin/quiz-details` - Get quiz analytics

## Development

### Running Tests
```bash
npm test
```

### Building for Production
```bash
npm run build
```

### Database Migrations
```bash
# Check migration status
node scripts/migration-status.js

# Run specific migration
node scripts/test-migration.js
```

## Environment Variables

See `.env.example` for all required environment variables. Key variables include:

- `DATABASE_TYPE`: Set to 'supabase'
- `NEXT_PUBLIC_SUPABASE_URL`: Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key
- `OPENAI_API_KEY`: OpenAI API key for AI features
- `ELEVENLABS_API_KEY`: ElevenLabs API key for TTS

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions, please refer to the documentation in the `scripts/README.md` file or create an issue in the repository.