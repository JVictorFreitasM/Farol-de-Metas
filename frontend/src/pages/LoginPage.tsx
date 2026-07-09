import { LoginForm } from "../components/LoginForm";

export function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">🚦 FAROL</div>
        <LoginForm />
      </div>
    </div>
  );
}
