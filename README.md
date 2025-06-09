# CompuTech's Advanced Student Online Examination Platform

A comprehensive, secure online examination platform built with React.js and Node.js, featuring advanced proctoring capabilities, MongoDB integration, Cloudflare R2 storage, and email notifications.

## 🌟 Features

### 🔐 **Security & Proctoring**
- **Advanced Proctoring System**: Tab switching detection, fullscreen enforcement, right-click prevention
- **Intelligent Violation Tracking**: Progressive 3-strike system with reduced false positives
- **Cross-Platform Security**: Works on desktop and mobile with adaptive security measures
- **Browser Monitoring**: Detects developer tools, copy-paste attempts, and other suspicious activities

### 👨‍💼 **Admin Features**
- **Dual Test Creation**: Manual question builder or PDF question paper uploads
- **Student Management**: Approve/block students, manage class and board assignments
- **Advanced Grading**: Edit marks, provide feedback, approve results for release
- **Email Notifications**: Send notifications to students by class/board combinations
- **Comprehensive Analytics**: Download individual reports, track performance metrics

### 🎓 **Student Features**
- **Secure Test Interface**: PDF viewer for question papers, answer sheet uploads
- **Real-time Monitoring**: Live timer, auto-save functionality, violation feedback
- **Results Dashboard**: View approved results, download answer keys, track progress
- **Mobile Responsive**: Optimized interface for tablets and smartphones

### 🎨 **Modern UI/UX**
- **Dark/Light Mode**: Seamless theme switching with CSS custom properties
- **Responsive Design**: Mobile-first approach with touch-optimized interactions
- **Color Scheme**: Purple (#8b5cf6), Green (#22c55e), Orange (#f97316) palette
- **Accessibility**: Keyboard navigation, screen reader support, high contrast modes

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js framework
- **MongoDB** with Mongoose ODM
- **JWT** authentication with role-based access
- **Cloudflare R2** for file storage (S3-compatible)
- **Nodemailer** for email notifications
- **Multer** for file upload handling

### Frontend
- **React 18** with modern hooks and Context API
- **React Router** for navigation
- **Axios** for API communication
- **PDF.js** for document viewing
- **React Toastify** for notifications

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v14.0.0 or higher)
- **npm** (v6.0.0 or higher)
- **Git** for version control

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/computech-exam-platform.git
cd computech-exam-platform
```

### 3. Install Dependencies
```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 4. Start Development Server
```bash
# Start both backend and frontend concurrently
npm run dev

# Or start them separately:
# Backend only
npm run server

# Frontend only (in another terminal)
npm run client
```

### 5. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **Admin Login**: mdalamrahman4@gmail.com / Zerocheck@admin1

## 📂 Project Structure

```
computech-exam-platform/
├── backend/
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API endpoints
│   ├── middleware/      # Authentication & security
│   ├── services/        # External service integrations
│   └── server.js        # Express server configuration
├── frontend/
│   ├── public/          # Static assets
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   ├── utils/       # Utility functions
│   │   ├── App.js       # Main application
│   │   └── index.js     # Entry point
│   └── package.json     # Frontend dependencies
├── .env                 # Environment variables
├── package.json         # Backend dependencies
└── README.md            # Project documentation
```

## 🗄️ Database Schema

### Student Schema
- **Basic Info**: name, email, class, board, school
- **Authentication**: passwordHash, email verification
- **Approval System**: approved status, blocking capabilities
- **Roll Number**: Auto-generated (class-board-sequence format)
- **Referral System**: referral codes and tracking

### Test Schema
- **Test Configuration**: title, subject, duration, marks
- **Creation Types**: manual, PDF, or hybrid approaches
- **Class/Board Filtering**: targeted test visibility
- **Proctoring Settings**: customizable security levels
- **Answer Keys**: upload and release management

### Result Schema
- **Response Tracking**: individual question responses
- **Violation Logging**: comprehensive security event tracking
- **Grading System**: marks, feedback, approval workflow
- **File Management**: answer sheet and document uploads

## 🔧 API Endpoints

### Authentication
- `POST /api/auth/login` - Login for admin/students
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/logout` - Logout (client-side)

### Admin Routes
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/students` - Student management
- `PUT /api/admin/students/:id/approval` - Approve/block students
- `POST /api/admin/tests` - Create new test
- `GET /api/admin/tests` - List all tests
- `PUT /api/admin/tests/:id` - Update test
- `DELETE /api/admin/tests/:id` - Delete test
- `POST /api/admin/notify-students` - Send email notifications
- `GET /api/admin/results` - View all results
- `PUT /api/admin/results/:id/grade` - Grade student responses
- `PUT /api/admin/results/:id/approve` - Approve results

### Student Routes
- `GET /api/student/dashboard` - Student dashboard
- `GET /api/student/tests` - Available tests
- `GET /api/student/tests/:id` - Test details
- `POST /api/student/tests/:id/start` - Start test
- `POST /api/student/tests/:resultId/response` - Save response
- `POST /api/student/tests/:resultId/violation` - Record violation
- `POST /api/student/tests/:resultId/submit` - Submit test
- `GET /api/student/results` - View approved results

### Upload Routes
- `POST /api/upload/question-paper/:testId` - Upload question paper
- `POST /api/upload/answer-key/:testId` - Upload answer key
- `POST /api/upload/answer-sheet/:resultId` - Upload answer sheet
- `GET /api/upload/file/:fileName` - Get file with signed URL

## 🚀 Deployment Options

### Option 1: Vercel + Railway (Recommended)

#### Deploy Frontend to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy frontend
cd frontend
vercel --prod
```

#### Deploy Backend to Railway
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy backend
railway up
```

### Option 2: Netlify + Render

#### Deploy Frontend to Netlify
1. Connect your GitHub repository to Netlify
2. Set build command: `cd frontend && npm run build`
3. Set publish directory: `frontend/build`
4. Add environment variables in Netlify dashboard

#### Deploy Backend to Render
1. Connect your GitHub repository to Render
2. Set build command: `npm install`
3. Set start command: `node server.js`
4. Add environment variables in Render dashboard

### Option 3: Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login to Heroku
heroku login

# Create applications
heroku create computech-backend
heroku create computech-frontend

# Set environment variables
heroku config:set MONGO_URI="your-mongo-uri" --app computech-backend
heroku config:set CLOUDFLARE_ACCESS_KEY="your-key" --app computech-backend
# ... add all environment variables

# Deploy
git push heroku main
```

### Option 4: Docker Deployment

```dockerfile
# Backend Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

```dockerfile
# Frontend Dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 🔒 Security Features

### Proctoring System
- **Tab Switch Detection**: Monitors page visibility changes
- **Fullscreen Enforcement**: Required for desktop and mobile
- **Browser Security**: Prevents developer tools, right-click, copy-paste
- **Violation Tracking**: Progressive warning system with auto-submission
- **Mobile Adaptations**: Touch-friendly with appropriate security measures

### Data Security
- **JWT Authentication**: Secure token-based authentication
- **Role-based Access**: Admin and student role separation
- **Input Validation**: Comprehensive input sanitization
- **File Upload Security**: Type validation, size limits, virus scanning
- **Rate Limiting**: API protection against abuse

### Privacy Protection
- **Data Encryption**: Secure transmission and storage
- **Access Control**: Granular permissions system
- **Audit Logging**: Comprehensive activity tracking
- **GDPR Compliance**: Data protection and user rights

## 📧 Email Templates

The platform includes professional HTML email templates for:
- **Test Notifications**: Inform students about new tests
- **Result Announcements**: Notify students when results are available
- **Reminders**: Automated deadline and important notices
- **System Alerts**: Administrative notifications

## 🎨 Theming & Customization

### CSS Custom Properties
The application uses CSS custom properties for easy theming:
```css
:root {
  --color-primary: #8b5cf6;
  --color-secondary: #22c55e;
  --color-accent: #f97316;
  /* ... more variables */
}

[data-theme="dark"] {
  --color-background: #0f172a;
  --color-text: #f8fafc;
  /* ... dark theme overrides */
}
```

### Responsive Design
- **Mobile-first**: Designed for mobile devices first
- **Breakpoints**: Optimized for phone, tablet, and desktop
- **Touch-friendly**: Large touch targets and intuitive gestures
- **Accessibility**: WCAG compliant with keyboard navigation

## 🐛 Troubleshooting

### Common Issues

#### MongoDB Connection Error
```bash
Error: MongoNetworkError: failed to connect to server
```
**Solution**: Check your MongoDB connection string and network connectivity.

#### Cloudflare R2 Upload Issues
```bash
Error: Access Denied
```
**Solution**: Verify your Cloudflare R2 credentials and bucket permissions.

#### Email Service Not Working
```bash
Error: Authentication failed
```
**Solution**: Ensure your Gmail app password is correct and 2FA is enabled.

#### Frontend Build Errors
```bash
Error: Module not found
```
**Solution**: Clear node_modules and reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
```

### Performance Optimization
- **Image Optimization**: Compress images and use appropriate formats
- **Code Splitting**: Implement lazy loading for large components
- **Caching**: Implement browser and server-side caching
- **CDN**: Use a CDN for static assets and global distribution

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Development Guidelines
- Follow ESLint configuration
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and questions:
- **Email**: mdalamrahman4@gmail.com
- **Documentation**: See inline code comments and API documentation
- **Issues**: Create a GitHub issue for bugs and feature requests

## 🙏 Acknowledgments

- **MongoDB Atlas** for database hosting
- **Cloudflare R2** for secure file storage
- **Gmail SMTP** for email delivery
- **React & Node.js** communities for excellent frameworks
- **Open Source Contributors** for various packages used

---

**Made with ❤️ by CompuTech Team**

*Secure, reliable, and modern online examination platform for educational institutions.*
