import { LoginForm } from "../components/LoginForm";
import farolIcon from "../assets/farol_de_metas_icon.svg";

export function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src={farolIcon} alt="Farol de Metas" className="login-logo-img" />
          FAROL
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
