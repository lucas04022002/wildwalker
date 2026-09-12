import "./InComingWorkshop.css";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { createPortal } from "react-dom";
import useSpaceAvailability from "../../../hooks/useSpaceAvailability";
import type { Space } from "../../../types/space";
import SpaceModal from "../../SpacesPage/Body/SpaceModal/SpaceModal";
import SpaceModalContent from "../../SpacesPage/Body/SpaceModal/SpaceModalContent/SpaceModalContent";

const today = new Date().toISOString().slice(0, 10);

interface WorkshopProps {
  workshop: Space;
}

function InComingWorkshop({ workshop }: WorkshopProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { availability: availMatin } = useSpaceAvailability(
    workshop.id,
    today,
    "1",
  );
  const { availability: availApresMidi } = useSpaceAvailability(
    workshop.id,
    today,
    "2",
  );

  return (
    <article className="incoming-workshop">
      <div
        className="incoming-workshop__top"
        style={{
          backgroundImage: workshop.url_image
            ? `url(${import.meta.env.VITE_API_URL ?? ""}${workshop.url_image})`
            : undefined,
        }}
      >
        <span className="incoming-workshop__category">
          {workshop.space_type}
        </span>
        <span className="incoming-workshop__price-badge">
          {workshop.price_unit} €
        </span>
      </div>

      <div className="incoming-workshop__description">
        <h1 className="workshop-featured__name">{workshop.space_name}</h1>
        <p className="incoming-workshop__today">Aujourd'hui</p>
        <span className="incoming-workshop__slot">
          Matin — {availMatin?.available ?? workshop.capacity}/
          {workshop.capacity} places
        </span>
        <span className="incoming-workshop__slot">
          Après-midi — {availApresMidi?.available ?? workshop.capacity}/
          {workshop.capacity} places
        </span>
      </div>

      <div className="incoming-workshop__footer">
        <button
          type="button"
          className="incoming-workshop__btn"
          onClick={() => setIsModalOpen(true)}
        >
          Voir l'espace
        </button>
      </div>

      {createPortal(
        <AnimatePresence>
          {isModalOpen && (
            <SpaceModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
            >
              <SpaceModalContent
                spaces={[workshop]}
                categoryName={workshop.space_category}
                onClose={() => setIsModalOpen(false)}
              />
            </SpaceModal>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </article>
  );
}

export default InComingWorkshop;
