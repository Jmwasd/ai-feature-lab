export type Session = {
  sub: string;
  email: string;
  name: string;
  picture: string;
  /** Epoch seconds, matching the Google ID token expiry. */
  exp: number;
};
