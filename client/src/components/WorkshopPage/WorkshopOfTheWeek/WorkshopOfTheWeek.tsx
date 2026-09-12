import "./WorkshopOfTheWeek.css";
import { AnimatePresence } from "framer-motion";
import { useState } from "react";
import { createPortal } from "react-dom";
import useSpaceAvailability from "../../../hooks/useSpaceAvailability";
import type { Space } from "../../../types/space";
import SpaceModal from "../../SpacesPage/Body/SpaceModal/SpaceModal";
import SpaceModalContent from "../../SpacesPage/Body/SpaceModal/SpaceModalContent/SpaceModalContent";

const today = new Date().toISOString().slice(0, 10);

interface WorkshopOfTheWeekProps {
  workshop: Space;
}

function WorkshopOfTheWeek({ workshop }: WorkshopOfTheWeekProps) {
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
    <section className="workshop-featured">
      <div className="workshop-featured__header">
        <h2 className="workshop-featured__title">NOS ATELIERS</h2>
        <hr className="workshop-featured__divider" />
      </div>

      <article className="workshop-featured__card">
        <div
          className="workshop-featured__img"
          style={{
            backgroundImage: workshop.url_image
              ? `url(${import.meta.env.VITE_API_URL ?? ""}${workshop.url_image})`
              : undefined,
          }}
        >
          <span className="workshop-featured__price-badge">
            {workshop.price_unit} €
          </span>
          <span className="workshop-featured__category">
            {workshop.space_type}
          </span>
        </div>

        <div className="workshop-featured__info">
          <h3 className="workshop-featured__name">{workshop.space_name}</h3>

          <div className="workshop-featured__availability">
            <p className="workshop-featured__today">Aujourd'hui</p>
            <span className="workshop-featured__slot">
              Matin — {availMatin?.available ?? workshop.capacity}/
              {workshop.capacity} places
            </span>
            <span className="workshop-featured__slot">
              Après-midi — {availApresMidi?.available ?? workshop.capacity}/
              {workshop.capacity} places
            </span>
          </div>

          <div className="workshop-featured_btn-div">
            <button
              type="button"
              className="workshop-featured__btn"
              onClick={() => setIsModalOpen(true)}
            >
              Voir l'espace
            </button>
          </div>
        </div>
      </article>

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
    </section>
  );
}

export default WorkshopOfTheWeek;
