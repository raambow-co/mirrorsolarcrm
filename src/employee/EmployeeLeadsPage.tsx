import LeadsPage from '../LeadsPage';

export default function EmployeeLeadsPage(props: any) {
  // Pass down any route filters to the centralized LeadsPage
  return <LeadsPage {...props} />;
}
