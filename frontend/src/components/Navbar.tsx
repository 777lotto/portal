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
    <nav style={{ padding: "1rem", background: "#eee", marginBottom: "2rem" }}>
      {token ? (
        <>
          <Link to="/dashboard" style={{ marginRight: "1rem" }}>Dashboard</Link>
          <button onClick={handleLogout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login" style={{ marginRight: "1rem" }}>Login</Link>
          <Link to="/signup">Signup</Link>
        </>
      )}
    </nav>
  );
}
