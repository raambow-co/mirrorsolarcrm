import type { User, UserPermissions } from '../context/CRMContext';

/**
 * Basic check if user has ANY access (view, edit, or full) to a module
 */
export const hasPermission = (user: User | null, module: keyof UserPermissions): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (!user.permissions) {
    return false;
  }
  const level = user.permissions[module];
  return level !== 'none' && level !== undefined;
};

/**
 * Strict check if user has 'full' or 'edit' access
 */
export const canManageModule = (user: User | null, module: keyof UserPermissions): boolean => {
  if (!user) return false;
  if (user.role === 'Admin') return true;
  if (!user.permissions) return false;
  const level = user.permissions[module];
  return level === 'full' || level === 'edit';
};

// --- Specific Module Helpers ---

export const canAccessDashboard = (user: User | null) => hasPermission(user, 'dashboard');
export const canAccessLeads = (user: User | null) => hasPermission(user, 'leads');
export const canAccessStock = (user: User | null) => hasPermission(user, 'stock');
export const canAccessReports = (user: User | null) => hasPermission(user, 'reports');
export const canAccessAccessControl = (user: User | null) => hasPermission(user, 'access');
export const canAccessEmployees = (user: User | null) => hasPermission(user, 'employees');
export const canAccessDealers = (user: User | null) => hasPermission(user, 'dealers');

export const canManageEmployees = (user: User | null) => canManageModule(user, 'employees');
export const canManageDealers = (user: User | null) => canManageModule(user, 'dealers');
export const canManageAccess = (user: User | null) => canManageModule(user, 'access');

// Route Mapping Helper
export const canAccessRoute = (user: User | null, routeTabName: string): boolean => {
  if (!user) return false;
  if (user.status === 'Inactive') return false; // Disabled users can't access anything

  switch (routeTabName) {
    case 'Dashboard':
      return canAccessDashboard(user);
    case 'Leads':
      return canAccessLeads(user);
    case 'Employees':
      return canAccessEmployees(user);
    case 'Dealers':
      return canAccessDealers(user);
    case 'Stock':
      return canAccessStock(user);
    case 'Reports':
      return canAccessReports(user);
    case 'Access':
      return canAccessAccessControl(user);
    case 'Payments':
      return user.role === 'Admin' || user.role === 'Dealer';
    case 'Profile':
      return hasPermission(user, 'profile');
    default:
      return true; // Unprotected or unknown routes default to true, or handle manually
  }
};
