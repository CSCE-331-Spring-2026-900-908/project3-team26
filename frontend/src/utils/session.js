export function logoutUser(navigate) {
  localStorage.removeItem('team26-role');
  localStorage.removeItem('team26-employee-id');
  navigate('/login');
}