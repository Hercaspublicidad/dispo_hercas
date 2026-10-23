import LoginForm from './LoginForm';
import './auth.css';

export const metadata = { title: 'Acceso | Hercas', robots: { index: false, follow: false } };

export default function Login() {
  return <LoginForm />;
}
