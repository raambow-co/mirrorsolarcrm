import LeadsPage from '../LeadsPage';

export default function DealerLeadsPage(props: any) {
  // Pass down any route filters to the centralized LeadsPage
  return <LeadsPage {...props} />;
}
