/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ComboboxProps {
  options: { label: string; value: string; description?: string }[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  name?: string;
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
  name
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");

  const selectedOption = options.find((option) => option.value === value);

  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (option.description && option.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className={cn("relative w-full", className)}>
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between bg-white h-11 border-slate-200 hover:bg-slate-50 transition-all text-left font-normal"
        onClick={() => setOpen(true)}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value || ""} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none shadow-2xl rounded-2xl">
          <DialogHeader className="p-4 border-b bg-slate-50/50">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400" />
              {placeholder}
            </DialogTitle>
          </DialogHeader>
          
          <div className="p-0">
            <div className="flex items-center border-b px-4 bg-white">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm("")}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="h-3 w-3 text-slate-400" />
                </button>
              )}
            </div>
            
            <div className="max-h-[300px] overflow-y-auto p-2 space-y-1 bg-slate-50/30">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500 italic">
                  {emptyText}
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-all text-left",
                      value === option.value 
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                        : "hover:bg-white hover:shadow-sm text-slate-700"
                    )}
                    onClick={() => {
                      onValueChange(option.value);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{option.label}</span>
                      {option.description && (
                        <span className={cn(
                          "text-xs opacity-70 truncate max-w-[300px]",
                          value === option.value ? "text-indigo-50" : "text-slate-500"
                        )}>
                          {option.description}
                        </span>
                      )}
                    </div>
                    {value === option.value && (
                      <Check className="h-4 w-4 stroke-[3px]" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
