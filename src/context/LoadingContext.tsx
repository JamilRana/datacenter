// context/LoadingContext.tsx
"use client";

import Loader from "@/components/Loader";
import React, { createContext, useContext, useState } from "react";

type LoadingContextType = {
  loading: boolean;
  showLoader: () => void;
  hideLoader: () => void;
};

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(false);

  const showLoader = () => setLoading(true);
  const hideLoader = () => setLoading(false);

  return (
    <LoadingContext.Provider value={{ loading, showLoader, hideLoader }}>
      {children}
      <Loader loading={loading} />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const context = useContext(LoadingContext);
  if (!context)
    throw new Error("useLoading must be used within LoadingProvider");
  return context;
}
