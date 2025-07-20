 // frontend/src/components/ServiceDetail.tsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// DEPRECATION NOTE: Since "Services" are now treated as line items for a "Job",
// this dedicated detail page is no longer necessary. All relevant information
// is available on the JobDetail page. This component now simply redirects
// the user to the main jobs list to avoid confusion.
 function ServiceDetail() {
  const navigate = useNavigate();

   useEffect(() => {
    navigate('/jobs', { replace: true });
  }, [navigate]);

  return null; // Render nothing while redirecting
 }

 export default ServiceDetail;
