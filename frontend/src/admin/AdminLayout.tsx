// frontend/src/admin/AdminLayout.tsx
import { Navigate, Outlet } from 'react-router-dom';

// You can move this interface to a shared types file later,
// but for now, we'll define it here.
interface UserPayload {
  id: string;
  email: string;
  name: string;
  role: 'customer' | 'admin';
}

interface AdminLayoutProps {
  user: UserPayload | null;
}

const AdminLayout = ({ user }: AdminLayoutProps) => {
  // Check if the user exists and their role is 'admin'
  if (user?.role === 'admin') {
    // The <Outlet /> component is a placeholder that will render
    // whichever nested route the user is currently visiting.
    // (e.g., <AdminDashboard />, <AdminPhotos />, etc.)
    return <Outlet />;
  }

  // If the user is not an admin (or not logged in),
  // redirect them away from the admin section.
  return <Navigate to="/dashboard" replace />;
};

export default AdminLayout;
