import { ButtonLink } from "@/components/ui/button";
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <div className="max-w-md text-center">
        <p className="font-semibold text-primary">404</p>
        <h1 className="mt-2 text-3xl font-bold">Page not found</h1>
        <p className="mt-3 text-muted-foreground">
          The page you requested does not exist or may have moved.
        </p>
        <ButtonLink className="mt-6" href="/">
          Return home
        </ButtonLink>
      </div>
    </main>
  );
}
