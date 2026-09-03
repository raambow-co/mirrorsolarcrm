import FollowupsPage from '../FollowupsPage';

export default function DealerFollowupsPage(props: any) {
  // Pass down any route filters to the centralized FollowupsPage
  return <FollowupsPage {...props} />;
}
