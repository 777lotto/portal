import { Link, useNavigate } from "react-router-dom";

interface Props {
  token: string | null;
  setToken: (token: string | null) => void;
}

export default function Navbar({ token, setToken }: Props) {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    navigate("/login");
  };

  return (
    <nav style={{
      padding: "1rem",
      background: "#eee",
      marginBottom: "2rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }}>
      <div>
        <strong style={{ marginRight: "2rem" }}>777 Solutions Customer Portal</strong>

        {token ? (
          <>
            <Link to="/dashboard" style={{ marginRight: "1rem" }}>
              Dashboard
            </Link>
            <Link to="/services" style={{ marginRight: "1rem" }}>
              Services
            </Link>
            <Link to="/calendar" style={{ marginRight: "1rem" }}>
              Calendar
            </Link>
            <Link to="/calendar-sync" style={{ marginRight: "1rem" }}>
              Sync Calendar
            </Link>
            <Link to="/sms" style={{ marginRight: "1rem" }}>
              Messages
            </Link>
          </>
        ) : (
          <>
            <Link to="/login" style={{ marginRight: "1rem" }}>
              Login
            </Link>
            <Link to="/signup">Signup</Link>
          </>
        )}
      </div>

      {token && (
        <button
          onClick={handleLogout}
          style={{
            background: "transparent",
            border: "1px solid #999",
            padding: "0.3rem 0.8rem",
            borderRadius: "4px",
            cursor: "pointer"
          }}
        >
          Logout
        </button>
      )}
    </nav>
  );
}
