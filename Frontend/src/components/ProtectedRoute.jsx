import { Navigate } from "react-router-dom";
import authStore from "../store/auth.store";

const ProtectedRoute = ({ children }) => {
  const { authUser, isCheckingAuth } = authStore();

  // wait until auth check finishes
  if (isCheckingAuth) return null;

  // 🔴 NOT LOGGED IN → GO HOME
  if (!authUser) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
