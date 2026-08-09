import React from 'react';

const DashboardHeader: React.FC = () => {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#242424] leading-tight">
        Dashboard for monitoring fraud and money laundering transactions
      </h1>
      <p className="font-sans text-sm text-[#666] mt-2 max-w-3xl">
        This slide showcases dashboard for monitoring fraudulent and money laundering transactions. It provides information about legitimacy, total transaction, unusual transactions, bank, client, investigation, peer review, etc.
      </p>
    </div>
  );
};

export default DashboardHeader;