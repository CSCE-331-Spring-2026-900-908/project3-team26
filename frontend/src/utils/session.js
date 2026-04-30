// Stores the logged-in user's session in localStorage so other pages (CashierPage,
// ManagerPage) can read who's signed in without round-tripping to the backend.
// Called by LoginPage on a successful PIN or Google sign-in.
// Values are simple strings so they can be read from any route without extra parsing.
export function saveUserSession({ employeeId, role, authProvider = 'pin', email = '', name = '' }) {
  localStorage.setItem('team26-role', role);
  localStorage.setItem('team26-employee-id', String(employeeId));
  localStorage.setItem('team26-auth-provider', authProvider);

  if (email) {
    localStorage.setItem('team26-google-email', email);
  } else {
    localStorage.removeItem('team26-google-email');
  }

  if (name) {
    localStorage.setItem('team26-google-name', name);
  } else {
    localStorage.removeItem('team26-google-name');
  }
}

// Clears the local session, signs the user out of Google's auto-select, and
// routes them back to the home page. Called by every page's Logout button.
export function logoutUser(navigate) {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.disableAutoSelect();
  }

  localStorage.removeItem('team26-role');
  localStorage.removeItem('team26-employee-id');
  localStorage.removeItem('team26-auth-provider');
  localStorage.removeItem('team26-google-email');
  localStorage.removeItem('team26-google-name');
  navigate('/');
}
