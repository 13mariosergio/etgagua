import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import "./Layout.css";

function AppLink({ to, children, ariaLabel }) {
  return (
    <NavLink
      to={to}
      aria-label={ariaLabel || String(children)}
      className={({ isActive }) => `app-link ${isActive ? "active" : ""}`}
    >
      {children}
    </NavLink>
  );
}

function NavLinks({ user }) {
  if (!user) return <AppLink to="/login">Login</AppLink>;

  if (user.role === "ADMIN") {
    return (
      <>
        <AppLink to="/admin" ariaLabel="Admin">Admin</AppLink>
        <AppLink to="/atendente" ariaLabel="Atendente">Atendente</AppLink>
        <AppLink to="/clientes" ariaLabel="Clientes">Clientes</AppLink>
        <AppLink to="/entregador" ariaLabel="Entregador">Entregador</AppLink>
        <AppLink to="/relatorios" ariaLabel="Relatórios">Relatórios</AppLink>
      </>
    );
  }

 if (user.role === "ATENDENTE") {
  return (
    <>
      <AppLink to="/atendente" ariaLabel="Atendente">Atendente</AppLink>
      <AppLink to="/clientes" ariaLabel="Clientes">Clientes</AppLink>
    </>
  );
}
  }

  if (user.role === "ENTREGADOR") {
    return <AppLink to="/entregador" ariaLabel="Entregador">Entregador</AppLink>;
  }

  return <AppLink to="/login">Login</AppLink>;


export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-row">
          <div className="brand" style={{ minWidth: 0 }}>
            <h1
              style={{
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title="ETGÁGUA"
            >
              ETGÁGUA
            </h1>

            {user ? (
              <span
                className="userline"
                style={{
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={`${user.username} (${user.role})`}
              >
                {user.username} ({user.role})
              </span>
            ) : null}
          </div>

          {/* Menu do topo (desktop/tablet) */}
          <nav className="nav top-nav" style={{ minWidth: 0 }}>
            <NavLinks user={user} />
          </nav>

          <div className="actions" style={{ minWidth: 0 }}>
            {user ? (
              <button className="btn" onClick={logout} type="button">
                Sair
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      {/* Barra inferior (mobile) - só aparece se logado */}
      {user ? (
        <footer className="bottom-nav">
          <nav className="nav" style={{ minWidth: 0 }}>
            <NavLinks user={user} />
          </nav>
        </footer>
      ) : null}
    </div>
  );
}
