// components/Loader.tsx
import React from "react";

const Loader = ({ loading }: { loading: boolean }) => {
  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 transition-opacity duration-300">
      <div className="bg-white p-6 rounded-full shadow-lg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-t-orange-500 border-orange-200 rounded-full animate-spin"></div>
      </div>
    </div>
  );
};

export default Loader;
