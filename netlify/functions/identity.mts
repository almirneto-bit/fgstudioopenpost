import type { UserSignupEvent } from '@netlify/functions';

// Convites novos começam como Criador.
// Administradores são promovidos explicitamente no Identity > Users.
export default {
  userSignup(event: UserSignupEvent) {
    return {
      user: {
        ...event.user,
        appMetadata: {
          ...event.user.appMetadata,
          roles: ['creator'],
        },
      },
    };
  },
};
