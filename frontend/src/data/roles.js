// Static list of selectable roles + their landing routes. Used by the UI when the
// user picks how they want to enter the app (cashier, manager, or kiosk).
export const roles = [
  {
    key: 'cashier',
    label: 'Cashier',
    description: 'Open the POS to create in-person orders and save payments.',
    route: '/cashier',
  },
  {
    key: 'manager',
    label: 'Manager',
    description: 'Review inventory, recent orders, reports, and maintenance tools.',
    route: '/manager',
  },
  {
    key: 'kiosk',
    label: 'Kiosk',
    description: 'Launch the customer-facing self-ordering tablet experience.',
    route: '/kiosk',
  },
];

