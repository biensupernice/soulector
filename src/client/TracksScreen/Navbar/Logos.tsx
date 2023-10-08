import React from "react";
import { Soulector } from "../../components/Icons";

export function SoulectionLogo() {
  return (
    <div className="flex items-center space-x-2">
      <Soulector className="h-8 w-8 fill-current" />
      <div className="text-2xl font-bold">Soulection</div>
    </div>
  );
}

export function SashaMarieRadioLogo() {
  return (
    <div className="flex items-center space-x-2">
      <Soulector className="h-10 w-10 fill-current" />
      <div className="w-full text-2xl font-bold">Sasha Marie Radio</div>
    </div>
  );
}
