import React from 'react';

const DashboardHeader: React.FC = () => {
  return (
    <div>
      <h1 className="font-serif text-3xl font-bold text-[#242424] leading-tight">
        Fraud and Money Laundering Investigation Workspace
      </h1>
      <p className="font-sans text-sm text-[#666] mt-2 max-w-3xl">
        Monitor live transaction activity, review high-risk alerts with evidence, and launch AI-led investigations for transaction-level decisions.
      </p>
    </div>
  );
};

export default DashboardHeader;