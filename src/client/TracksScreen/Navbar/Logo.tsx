import React from "react";
import { Soulector } from "../../components/Icons";

export default function Logo() {
  return (
    <div className="flex space-x-2 items-center">
      <Soulector className="h-8 w-8" />
      <div className="text-2xl font-bold">Soulection</div>
    </div>
  );
}
