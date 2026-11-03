'use client';

import { logout } from '@netlify/identity';

export default function LogoutButton() {
  return (
    <button
      type="button"
      className="sm-post-secondary-btn"
      onClick={async () => {
        try {
          await logout();
          window.location.assign('/login');
        } catch {
          window.alert('Não foi possível sair. Tente novamente.');
        }
      }}
    >
      Sair
    </button>
  );
}
