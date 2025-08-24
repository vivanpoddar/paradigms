import Image from "next/image";

export const MobileBlocker = () => {
  return (
      <div className="fixed bg-black justify-center items-center z-[10000] xl:hidden h-screen w-screen flex flex-col">
          <Image
              src="/logo-dark.svg"
              alt="Logo"
              width={150}
              height={150}
              className="mb-4"
          />
          <span className="flex justify-center items-center text-white text-lg">Not currently available for mobile devices.</span>
      </div>
  );
};