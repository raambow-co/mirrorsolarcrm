# CURRENT_PROJECT_DOCUMENTATION

## 1. Project Overview
**What this application is**:
This is a web-based Customer Relationship Management (CRM) application named "Solar CRM", specifically tailored for a solar energy business (Mirror Solar).

**Primary Purpose**:
To manage solar leads, employee activities, dealer networks, and stock inventory.

**Target Users**:
- Administrators (Full oversight)
- Employees (Sales/field agents managing leads)
- Dealers (Partner networks generating and managing leads)

**Current Development Status**:
The application is in active development. It currently functions primarily as a highly detailed UI prototype/frontend with state management handled entirely via React Context and mock data.

**What appears to be completed**:
- Frontend UI architecture and theming.
- Role-based dashboard interfaces for Admin, Employee, and Dealer.
- Comprehensive UI for Lead management, Stock management, Employee/Dealer management, and Reports.
- State management structure via React Context.

**What appears to be incomplete**:
- Real backend data integration. Almost all data (leads, dealers, employees, activities, stock) is mocked.
- Authentication flow. While Firebase configuration and a seeding script exist, the primary application login bypasses real authentication to use mock contexts.
- Routing is handled via a rudimentary manual hash-change event listener rather than a robust routing library.

## 2. Technology Stack
**Framework**: React 19
**Programming Language**: TypeScript
**Build Tool**: Vite
**UI Framework**: Custom React Components
**CSS Framework**: Vanilla CSS (No Tailwind, Bootstrap, or Material UI)
**Component Libraries**: None (bespoke implementation)
**Icons**: `lucide-react`
**Animation Libraries**: CSS Keyframes (bespoke)
**State Management**: React Context API (`CRMContext`, `AuthContext`, `StockContext`, `UIContext`)
**Routing**: Manual Hash Routing (`window.location.hash`) inside `App.tsx`
**Backend**: Firebase (Partially configured)
**Database**: Firestore (Configured, but largely unused except for user seeding)
**Authentication**: Firebase Auth (Configured, user seeding script exists, but app uses mocked auth)
**Storage**: None currently integrated
**Package Versions**:
- `react`: ^19.2.8
- `react-dom`: ^19.2.8
- `firebase`: ^12.18.0
- `lucide-react`: ^1.31.0
- `vite`: ^8.2.0

## 3. Complete Folder Structure
```text
m solar crm/
├── package.json
├── vite.config.ts
├── src/
│   ├── App.tsx                  # Main application orchestrator & routing
│   ├── App.css                  # Global styles
│   ├── main.tsx                 # Entry point
│   ├── index.css                # CSS variables and resets
│   ├── firebase.ts              # Firebase initialization
│   ├── seedFirebase.ts          # Script to seed auth and users to Firestore
│   ├── RoleSelection.tsx        # Splash/role selection screen
│   ├── LoginScreen.tsx          # Login UI
│   ├── AdminDashboard.tsx       # Admin main layout
│   ├── LeadsPage.tsx            # Leads management view
│   ├── EmployeesPage.tsx        # Employee directory view
│   ├── DealersPage.tsx          # Dealer network view
│   ├── StockPage.tsx            # Inventory view
│   ├── AdminReportsPage.tsx     # Reporting view
│   ├── AdminAccessPage.tsx      # Access control view
│   ├── components/
│   │   └── AccessRestricted.tsx # Shared UI for restricted access
│   ├── context/
│   │   ├── AuthContext.tsx      # Mock authentication state
│   │   ├── CRMContext.tsx       # Core mock database (Leads, Users, Activities)
│   │   ├── StockContext.tsx     # Mock inventory state
│   │   └── UIContext.tsx        # UI state (modals, sidebars)
│   ├── employee/
│   │   ├── EmployeeApp.tsx      # Employee main layout
│   │   ├── EmployeeDashboard.tsx
│   │   └── EmployeeSidebar.tsx
│   ├── dealer/
│   │   ├── DealerApp.tsx        # Dealer main layout
│   │   ├── DealerDashboard.tsx
│   │   └── DealerSidebar.tsx
│   ├── utils/                   # Helper functions
│   └── assets/                  # Static assets (images, logos)
```

## 4. Pages and Routes
The application uses a manual hash-based routing system built in `App.tsx` listening to `window.location.hash`.

| Route | Page | Purpose | Status |
|-------|------|---------|--------|
| `/` or `/role` | `RoleSelection` | Initial role selection screen | Complete (UI) |
| `/login` | `LoginScreen` | User authentication | UI only (Mocked Auth) |
| `/admin/dashboard` | `AdminDashboard` | Main dashboard for Admin | Complete (Mock Data) |
| `/employee/dashboard` | `EmployeeApp` | Main dashboard for Employees | Complete (Mock Data) |
| `/dealer/dashboard` | `DealerApp` | Main dashboard for Dealers | Complete (Mock Data) |
| `Not Found` | 404 Fallback | Invalid hash fallback | Complete |

## 5. UI / UX
**Design System**: Custom built using pure CSS.
**Colors**:
- Primary: Navy (`#0B1F3A`)
- Secondary: Yellow (`#F4C430`), Orange (`#F59E0B`)
- Background: White (`#FFFFFF`), Light Gray (`#f8fafc`)
**Typography**:
- Font: `Outfit`, system-ui, sans-serif
**Animations**:
- Custom SVG energy and solar arc animations on the splash screen.
- Fade-in, reveal, and micro-line transitions for loading.
**Components**: 
- Cards, Modals, Tables, Sidebars, and Buttons are all styled heavily in component-specific `.css` files (e.g., `AdminDashboard.css`, `LoginScreen.css`).

## 6. Components
There are few "shared" components in `src/components/`, most UI elements are monolithic page components.
- `AccessRestricted.tsx` (in `src/components`): Used to display a fallback UI when a user lacks permission to view a page.
- `RoleSelection.tsx`: Displays three roles (Admin, Employee, Dealer) to initiate the mock login flow.
- Context Providers (`CRMProvider`, `StockProvider`, etc.): Contain the business logic and mock data generation functions.

## 7. Existing Features
**Authentication Flow**:
- Splash screen -> Role Selection -> Login Screen.

**CRM Management (Admin Dashboard)**:
- Leads Management: Add, edit, change stage (Lead, Converted, Loan, Material, PM Survey, Completed), assign priority.
- Employee Management: Add, edit, view status, manage permissions.
- Dealer Management: Add, edit, view status.
- Stock/Inventory Management: Track items, manage quantities.
- Reports: View mock statistics and charts.
- Access Control: Granular permission levels (`full`, `edit`, `view`, `none`).

**Employee & Dealer Sub-Apps**:
- Scoped dashboards showing only relevant data (Leads, Stock) based on mock permissions.

## 8. Data Flow
`User Action` -> `Page Component` -> `React Context (e.g., CRMContext)` -> `Update Mock State` -> `Re-render UI`.

**Mock Data Locations**:
- `src/context/CRMContext.tsx`: Generates mock Leads, Employees, Dealers, and Activities using functions like `generateMockLeads()`.
- `src/context/StockContext.tsx`: Generates mock stock inventory data.

## 9. Backend / Firebase Status
**Firebase backend status**: PARTIALLY CONNECTED.

- **Configuration**: Exists in `src/firebase.ts`.
- **SDK Usage**: Imported and initialized.
- **Authentication**: `seedFirebase.ts` creates real users in Firebase Auth, but the app itself mostly bypasses this via `AuthContext.tsx` which manually sets `currentUser` upon fake login.
- **Firestore**: `seedFirebase.ts` writes users to a `users` collection. No other collections (Leads, Stock, Activities) are currently queried or written to by the main application.
- **Cloud Functions / Storage**: None.
- **Note on Credentials**: API keys exist in `firebase.ts` but are client-side public keys typical for Firebase web setups.

## 10. Authentication and Authorization
**Implemented**:
- Granular permission logic exists in `CRMContext.tsx` (`UserPermissions` interface).
- Role checks happen in `App.tsx` hash routing.

**UI/Mock/Placeholder**:
- Login form is UI only. Submitting it sets a mock user context and routes to the dashboard.
- Session handling is temporary and lost on full page refresh.

## 11. Database / Data Models
Currently defined as TypeScript interfaces in Contexts, not yet enforced in a real DB.
- **MockLead**: `id`, `customer`, `phone`, `stage` (Lead, Converted, Loan, Material, PM Survey, Completed), `priority`, `followUp`, etc.
- **User / Employee / Dealer**: `id`, `name`, `email`, `role`, `status`, `permissions` (dashboard, leads, employees, dealers, stock, reports, access, profile).
- **Activity**: `id`, `type`, `message`, `user`, `timestamp`.

## 12. Forms and Validation
Forms exist in various Modals across the application (e.g., Add Lead, Add Employee).
- **Validation**: Basic HTML required attributes and simple React state checks.
- **Data Destination**: Updates React Context array state.

## 13. API / External Integrations
- **Firebase Auth / Firestore**: Configured but largely dormant except for a utility seeding script.
- No other external APIs are used.

## 14. State Management
- **React Context**: The entire architecture relies on Context for global state.
  - `CRMContext`: Handles Leads, Users, and Permissions.
  - `StockContext`: Handles Inventory.
  - `UIContext`: Handles global UI elements like open Modals or Sidebar toggle state.
  - `AuthContext`: Handles current session user.

## 15. Mock Data
- **`src/context/CRMContext.tsx`**: Generates arrays of random Leads, Dealers, and Employees.
  - **Used by**: All Dashboard pages, Leads Pages, Employee Pages, etc.
  - **Replacement**: Will eventually be replaced by Firestore `collection('leads')`, `collection('users')`, etc.
- **`src/context/StockContext.tsx`**: Generates mock inventory.
  - **Used by**: `StockPage.tsx`.
  - **Replacement**: Will eventually be replaced by Firestore `collection('inventory')`.

## 16. Existing Security
- **Route Protection**: `App.tsx` has basic checks determining if a user object exists before resolving a `#dashboard` route.
- **Firebase Security Rules**: Unknown/None configured in the source code.
- **Role Checks**: Conditional rendering exists in Context and Components to hide/show buttons based on `permissions` object.
- **Overall**: Highly insecure currently, as it is a client-side mocked application.

## 17. Build and Deployment
- **Development Command**: `npm run dev`
- **Build Command**: `npm run build` (`tsc -b && vite build`)
- **Environment Variables**: None currently used (Firebase config is hardcoded).
- **Hosting/Deployment**: No specific configuration files for Vercel, Netlify, or Firebase Hosting are present.

## 18. Dependencies
- **Core**: `react`, `react-dom`, `typescript`
- **Build/Routing**: `vite` (Routing is manual vanilla JS)
- **Firebase**: `firebase`
- **UI/Icons**: `lucide-react`
- **Development tools**: `oxlint`, `@vitejs/plugin-react`

## 19. Current Limitations / Missing Backend
- **Real Authentication**: Needs wiring Firebase Auth into `LoginScreen.tsx` and `AuthContext.tsx`.
- **Database Integration**: Needs converting `CRMContext` and `StockContext` state arrays into real-time Firestore listeners (`onSnapshot`) and mutation functions (`addDoc`, `updateDoc`).
- **Robust Routing**: `window.location.hash` is fragile. Needs `react-router-dom`.
- **Environment Configuration**: Hardcoded Firebase keys should be moved to `.env` variables (even if they are `VITE_` public keys).
- **Security Rules**: Firestore requires role-based security rules to prevent Dealers from reading all Admin data.

## 20. Production Readiness
- **Frontend completeness**: 85% (UI is very polished)
- **Backend completeness**: 10% (Firebase initialized, but disconnected from UI)
- **Authentication completeness**: 20% (UI exists, mock auth exists)
- **Database completeness**: 10% (Models defined as TS interfaces, not in DB)
- **Security completeness**: 5%
- **Testing completeness**: 0%
- **Deployment readiness**: 20%

## 21. Recommended Next Development Areas
**Critical**:
1. Implement a real routing library (e.g., `react-router-dom`) to replace the custom hash routing.
2. Integrate Firebase Authentication directly into the login components to replace the mock Context authentication.
3. Migrate `CRMContext` and `StockContext` to read from and write to Firestore instead of utilizing static mock arrays.

**Important**:
1. Implement Firestore Security Rules based on user roles (Admin, Employee, Dealer).
2. Move Firebase configuration to environment variables (`.env`).

**Optional**:
1. Add a file storage solution for lead documents (Firebase Storage).
2. Implement push notifications or email alerts for assigned leads.

## 22. Final Executive Summary
The Mirror Solar CRM is a highly polished, custom-styled frontend prototype built with React, TypeScript, and Vite. Currently, the application boasts a fully functional user interface complete with role-based dashboards, lead management, and inventory tracking. However, almost all functionality is powered by heavily utilized React Contexts producing mock data. While Firebase has been initialized and users can be seeded via a script, the actual UI remains disconnected from the backend database. To transition to a production-ready application, the immediate priority must be integrating Firebase Authentication into the login flow, replacing the mock state arrays with Firestore queries, and upgrading the manual hash-based routing to a standard routing library.
