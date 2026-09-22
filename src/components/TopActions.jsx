import { NavLink } from "react-router-dom";
import { UserRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { NotificationCenter } from "./NotificationCenter.jsx";

function getUserName(user) {
  return user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Sign In";
}

function getUserAvatar(user) {
  return user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
}

export default function TopActions() {
  const { user } = useAuth();
  const avatarUrl = getUserAvatar(user);

  return (
    <div className="app-top-actions" aria-label="Account and notifications">
      <NotificationCenter />
      <span className="top-cluster-divider" aria-hidden="true" />
      <NavLink className="top-account-link" to="/account" aria-label={user ? `Account for ${getUserName(user)}` : "Sign in"}>
        <span className="top-account-avatar" aria-hidden="true">
          {user && avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={18} />}
        </span>
        <span className="top-account-name">{getUserName(user)}</span>
      </NavLink>
    </div>
  );
}
