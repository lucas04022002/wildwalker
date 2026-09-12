import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import type { Space } from "../../../../../types/space";
import BookingForm from "../BookingForm/BookingForm";
import "./SpaceModalContent.css";

type SpaceModalContentProps = {
  spaces: Space[];
  categoryName: string;
  onClose: () => void;
};

/**
 * Contenu de la modale affichée pour une catégorie d'espaces : un carrousel permettant de parcourir les différents espaces de cette catégorie, avec bascule animée vers le formulaire de réservation (BookingForm).
 */
function SpaceModalContent({
  spaces,
  categoryName,
  onClose,
}: SpaceModalContentProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Bascule entre la vue "détails de l'espace" et le formulaire de réservation
  const [showBookingForm, setShowBookingForm] = useState(false);

  const currentSpace = spaces[currentIndex];

  const isLocal = currentSpace.space_category === "Local vide";
  const isMeetRoom = currentSpace.space_category === "Salle de réunion";

  const isStudio = ["Studio d'enregistrement", "Studio photo"].includes(
    currentSpace.space_category,
  );

  // Navigue vers l'espace précédent du carrousel, en bouclant à la fin
  const handlePrev = () =>
    setCurrentIndex((i) => (i === 0 ? spaces.length - 1 : i - 1));

  // Navigue vers l'espace suivant du carrousel, en bouclant au début
  const handleNext = () =>
    setCurrentIndex((i) => (i === spaces.length - 1 ? 0 : i + 1));

  return (
    <motion.div className="space-modal-content" layout>
      {/* Bandeau image en haut : se réduit en hauteur quand on bascule vers le formulaire de réservation, pour laisser plus de place à celui-ci */}
      <motion.div
        className="space-modal-image-wrapper"
        animate={{
          height: showBookingForm ? 100 : 180,
        }}
        transition={{
          duration: 0.35,
          ease: "easeInOut",
        }}
      >
        <button type="button" className="space-modal-close" onClick={onClose}>
          ✕
        </button>

        <motion.img
          className="space-modal-image"
          src={`${import.meta.env.VITE_API_URL}${currentSpace.url_image}`}
          alt={currentSpace.space_name}
          animate={{
            scale: showBookingForm ? 1.05 : 1,
          }}
          transition={{
            duration: 0.35,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      <motion.div className="space-modal-body" layout>
        {/* AnimatePresence permet une transition animée (fondu + glissement) entre la vue "détails" et la vue "formulaire de réservation" */}
        <AnimatePresence mode="wait">
          {showBookingForm ? (
            <motion.div
              key="booking"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <BookingForm
                space={currentSpace}
                onBack={() => setShowBookingForm(false)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="space-modal-content-title">{categoryName}</h2>

              {/* Carrousel : flèches de navigation visibles uniquement s'il y a plusieurs espaces dans cette catégorie */}
              <div className="space-modal-content-carousel">
                {spaces.length > 1 && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="space-modal-content-carousel-arrow"
                  >
                    ‹
                  </button>
                )}

                <section className="space-modal-content-carousel-slide">
                  <h3 className="space-modal-content-carousel-slide-name">
                    {currentSpace.space_name}
                  </h3>

                  <p className="space-modal-content-carousel-slide-description">
                    {currentSpace.description}
                  </p>

                  <p className="space-modal-content-carousel-slide-price">
                    {currentSpace.price_unit}€
                    {isLocal
                      ? " / mois"
                      : isStudio
                        ? " / séance"
                        : isMeetRoom
                          ? " / séance"
                          : " / place"}
                  </p>
                  {/* La capacité ne s'affiche que pour les salles de réunion */}
                  {isMeetRoom && (
                    <p className="space-modal-content-carousel-slide-capacity">
                      Capacité : {currentSpace.capacity} personnes
                    </p>
                  )}
                </section>

                {spaces.length > 1 && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="space-modal-content-carousel-arrow"
                  >
                    ›
                  </button>
                )}
              </div>
              <div className="space-modal-content-counter-book-button-div">
                {/* Compteur "x / n" et points de pagination, uniquement si plusieurs espaces sont disponibles dans cette catégorie */}
                {spaces.length > 1 && (
                  <>
                    <p className="space-modal-content-counter">
                      {currentIndex + 1} / {spaces.length}
                    </p>

                    <div className="space-modal-content-dots">
                      {spaces.map((space, index) => (
                        <button
                          key={space.id}
                          type="button"
                          className={
                            index === currentIndex ? "dot active" : "dot"
                          }
                          onClick={() => setCurrentIndex(index)}
                        />
                      ))}
                    </div>
                  </>
                )}

                <button
                  type="button"
                  className="space-modal-content-book-button"
                  onClick={() => setShowBookingForm(true)}
                >
                  Réserver cet espace
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

export default SpaceModalContent;
