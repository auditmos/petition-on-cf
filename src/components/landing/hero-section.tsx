import { ArrowRight, Github } from "lucide-react";
import { PROJECT_LINKS } from "@/components/landing/project-links";
import { Button } from "@/components/ui/button";

export function HeroSection() {
	return (
		<section className="bg-gradient-to-br from-brand-deep via-brand-dark to-brand text-white">
			<div className="mx-auto max-w-6xl px-6 py-24 sm:py-32 lg:px-8">
				<p className="flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-white/70">
					<span aria-hidden="true" className="h-px w-8 bg-white/50" />
					Szablon open source · Cloudflare Workers
				</p>

				<h1 className="mt-6 max-w-3xl text-4xl leading-tight sm:text-5xl lg:text-6xl">
					Strona petycji, którą wdrażasz na własnym koncie
				</h1>

				<p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/80">
					Jedno wdrożenie to jedna petycja. Formularz podpisu ze zgodami RODO, licznik podpisów
					aktualizowany na żywo, mapa poparcia w województwach i treści po polsku oraz po angielsku.
					Wszystko działa na Twoim koncie Cloudflare — bez platformy pośredniczącej, bez abonamentu
					i bez oddawania komukolwiek danych osób podpisujących.
				</p>

				<div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
					<Button
						size="lg"
						asChild
						className="group bg-white text-brand-dark hover:bg-white/90 hover:text-brand-deep"
					>
						<a href={PROJECT_LINKS.repository} target="_blank" rel="noopener noreferrer">
							<Github className="mr-2 h-4 w-4" />
							Zobacz repozytorium
						</a>
					</Button>

					<a
						href={PROJECT_LINKS.prd}
						target="_blank"
						rel="noopener noreferrer"
						className="group inline-flex items-center self-start border-b border-white/40 pb-1 text-sm font-medium text-white transition-colors hover:border-white sm:self-auto"
					>
						Przeczytaj założenia projektu
						<ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
					</a>
				</div>

				<p className="mt-12 max-w-2xl border-l-2 border-white/30 pl-4 text-sm leading-relaxed text-white/70">
					<strong className="font-semibold text-white">Szablon powstaje na Twoich oczach.</strong>{" "}
					Ta strona opisuje, co znajdzie się w gotowym szablonie i na jakim etapie jest każdy
					element. Nic tu nie jest prawdziwą petycją i nikt nie zbiera tu jeszcze podpisów.
				</p>
			</div>
		</section>
	);
}
