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
